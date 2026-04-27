import { logger } from "../../utils/logger.js";
import { getPseudoAutocomplete } from "../utils/autocomplete.js";
import { getCollabState } from "../utils/settings.js";
import { getEmbedForCategory } from "../utils/embeds.js";
import Hierarchy from "../../models/Hierarchie.js";
import Log from "../../models/Logs.js";
import StaffUser from '../../models/StaffUser.js';
import Absence from '../../models/Absence.js'; 
import { buildHierarchyEmbed } from "../utils/embeds.js";

import { ActionRowBuilder, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, EmbedBuilder } from 'discord.js';

// ==========================================
// 🛠️ CONFIGURATION DES IDS (À REMPLIR)
// ==========================================
const SETTINGS = {
    ROLES: {
        SERVICE: "1498250482802495600",     // ID du rôle "En Service"
        ABSENT: "1498241578416734308",       // ID du rôle "Absent"
        ADMINS: ["1381159291372830820", "1492493841696034867"]  // Liste des IDs rôles autorisés à refresh
    },
    CHANNELS: {
        LOGS_ABSENCES: "1494594500511924425" // Ton salon de logs
    }
};

export default {
  name: "interactionCreate",

  async execute(client, interaction) {
    const { customId, user, member, guild } = interaction;
    
    logger.info(`[INTERACTION] Type: ${interaction.type} | ID: ${customId || interaction.commandName} | User: ${user.tag}`);

    try {
      // 1. AUTOCOMPLÉTION
      if (interaction.isAutocomplete()) {
        if (interaction.commandName === "info") {
          return getPseudoAutocomplete(interaction, interaction.options.getFocused());
        }
        return;
      }

      // 2. COMMANDES SLASH
      if (interaction.isChatInputCommand()) {
        const cmd = client.commands.get(interaction.commandName);
        if (cmd) return cmd.execute(interaction);
        return;
      }

      // 3. BOUTONS
      if (interaction.isButton()) {

        // --- LOGIQUE DE SERVICE (duty_on / duty_off) ---
        if (customId === 'duty_on' || customId === 'duty_off') {
          const staff = await StaffUser.findOne({ discordId: user.id });
          if (!staff) return interaction.reply({ content: "❌ Vous n'êtes pas répertorié staff dans la base de données.", ephemeral: true });

          if (customId === 'duty_on') {
            if (staff.status === 'SERVICE') return interaction.reply({ content: "⚠️ Déjà en service !", ephemeral: true });
            
            staff.status = 'SERVICE';
            staff.currentServiceStart = new Date();
            await staff.save();
            
            // ✅ Mise à jour Rôle & Pseudo
            try { 
                await member.roles.add(SETTINGS.ROLES.SERVICE); 
                logger.info(`✅ Service ON pour ${user.tag}`);
            } catch (e) { logger.error("Erreur roles/pseudo duty_on: " + e.message); }

            return interaction.reply({ content: "🟢 **Service démarré.** Bon courage !", ephemeral: true });
          }

          if (customId === 'duty_off') {
            if (staff.status !== 'SERVICE') return interaction.reply({ content: "⚠️ Vous n'étiez pas en service.", ephemeral: true });

            const durationMs = Date.now() - (staff.currentServiceStart || Date.now());
            staff.totalServiceTime += durationMs;
            staff.weeklyServiceTime += durationMs;
            staff.status = 'OFFLINE';
            staff.currentServiceStart = null;
            staff.lastServiceEnd = new Date();
            await staff.save();

            // ✅ Mise à jour Rôle & Pseudo
            try { 
                await member.roles.remove(SETTINGS.ROLES.SERVICE); 
                logger.info(`✅ Service OFF pour ${user.tag}`);
            } catch (e) { logger.error("Erreur roles/pseudo duty_off: " + e.message); }
            
            return interaction.reply({ content: `🔴 **Service terminé.** (\`${Math.floor(durationMs / 60000)} min\` ajoutées)`, ephemeral: true });
          }
        }

        // --- REFRESH HIÉRARCHIE ---
        if (customId === "refresh_hierarchy") {
          const hasPermission = member.roles.cache.some(role => SETTINGS.ROLES.ADMINS.includes(role.id));
          if (!hasPermission) return interaction.reply({ content: "❌ Permission insuffisante.", ephemeral: true });
          await interaction.deferReply({ ephemeral: true });
          await interaction.guild.members.fetch({ force: true });
          return interaction.editReply({ content: "✅ Cache des membres mis à jour !" });
        }

        // --- FORMULAIRE ABSENCE ---
        if (customId === 'btn_open_absence_form') {
          const row = new ActionRowBuilder().addComponents(
              new StringSelectMenuBuilder()
                  .setCustomId('select_absence_type')
                  .setPlaceholder('Où serez-vous absent ?')
                  .addOptions([
                      { label: 'En jeu (Roblox)', value: 'JEU', emoji: '🎮' },
                      { label: 'Sur Discord', value: 'DISCORD', emoji: '💬' },
                      { label: 'Les deux', value: 'LES DEUX', emoji: '🌎' },
                  ])
          );
          return interaction.reply({ content: 'Choisissez le domaine :', components: [row], ephemeral: true });
        }

        // --- SUPPRESSION / ARCHIVAGE ABSENCE ---
        if (customId === 'btn_delete_absence') {
          const userAbsences = await Absence.find({ discordId: user.id, status: "ACTIVE" }).sort({ createdAt: -1 });

          if (userAbsences.length === 0) return interaction.reply({ content: "❌ Aucune absence active trouvée.", ephemeral: true });

          if (userAbsences.length === 1) {
            const abs = userAbsences[0];
            abs.status = "ARCHIVED";
            await abs.save();

            // ✅ Optionnel : On retire le rôle absent quand il archive
            try { await member.roles.remove(SETTINGS.ROLES.ABSENT); } catch(e) {}

            return interaction.reply({ content: `✅ Votre absence du ${abs.startDate} a été archivée.`, ephemeral: true });
          }

          const selectMenu = new StringSelectMenuBuilder()
              .setCustomId('select_delete_absence_action')
              .setPlaceholder('Quelle absence voulez-vous archiver ?')
              .addOptions(userAbsences.slice(0, 25).map(abs => ({
                  label: `Du ${abs.startDate} au ${abs.endDate}`,
                  description: `Motif: ${abs.reason.substring(0, 50)}`,
                  value: abs._id.toString()
              })));

          return interaction.reply({ content: "Choisissez l'absence à archiver :", components: [new ActionRowBuilder().addComponents(selectMenu)], ephemeral: true });
        }
      }

      // 4. MENUS DÉROULANTS
      if (interaction.isStringSelectMenu()) {
        const { values } = interaction;

        if (customId === 'select_absence_type') {
            const modal = new ModalBuilder().setCustomId(`modal_absence|${values[0]}`).setTitle('Formulaire d\'absence');
            modal.addComponents(
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('date_debut').setLabel("Début (JJ/MM HH:MM)").setStyle(TextInputStyle.Short).setPlaceholder('Ex: 12/05 14:00').setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('date_fin').setLabel("Fin (JJ/MM HH:MM)").setStyle(TextInputStyle.Short).setPlaceholder('Ex: 15/05 20:00').setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('motif').setLabel("Motif").setStyle(TextInputStyle.Paragraph).setPlaceholder('Raison...').setRequired(true))
            );
            return await interaction.showModal(modal);
        }

        if (customId === 'select_delete_absence_action') {
            const abs = await Absence.findById(values[0]);
            if (!abs) return interaction.update({ content: "❌ Absence introuvable.", components: [] });
            abs.status = "ARCHIVED";
            await abs.save();
            try { await member.roles.remove(SETTINGS.ROLES.ABSENT); } catch(e) {}
            return interaction.update({ content: `✅ Absence du ${abs.startDate} archivée.`, components: [] });
        }

        if (customId === "rp_menu_select") {
            const collabState = await getCollabState();
            let selected = values[0] === "accueil" ? null : values[0];
            return interaction.reply({ embeds: [getEmbedForCategory(selected, collabState)], ephemeral: true });
        }

        if (customId === "select_hierarchy") {
            await interaction.deferReply({ ephemeral: true });
            const config = await Hierarchy.findOne({ messageId: interaction.message.id });
            const index = parseInt(values[0].split("_")[1]);
            const targetCat = config?.categories[index];
            if (!targetCat) return interaction.editReply("❌ Erreur.");
            const embed = await buildHierarchyEmbed(interaction.guild, targetCat.name, targetCat.roles);
            return interaction.editReply({ embeds: [embed] });
        }

        if (customId === 'select_justification') {
          const [logId, raison] = values[0].split('|');
          const log = await Log.findById(logId);
          if (!log) return interaction.update({ content: "❌ Log introuvable.", components: [] });
          log.category = "JUSTIFIÉ";
          log.action = `[JUSTIFIÉ] ${raison}`;
          await log.save();
          return interaction.update({ content: `✅ Justifié !`, components: [] });
        }
      }

      // 5. MODALS
      if (interaction.isModalSubmit()) {
          if (interaction.customId.startsWith('modal_absence')) {
              const type = interaction.customId.split('|')[1];
              const debut = interaction.fields.getTextInputValue('date_debut');
              const fin = interaction.fields.getTextInputValue('date_fin');
              const motif = interaction.fields.getTextInputValue('motif');

              await Absence.create({
                  discordId: user.id,
                  username: user.username,
                  type: type,
                  startDate: debut,
                  endDate: fin,
                  reason: motif,
                  status: "ACTIVE"
              });

              // ✅ AJOUT DU RÔLE ABSENT IMMÉDIATEMENT
              try {
                  await member.roles.add(SETTINGS.ROLES.ABSENT);
                  logger.info(`✅ Rôle absent appliqué à ${user.tag}`);
              } catch (e) {
                  logger.error("Erreur application rôle absent: " + e.message);
              }

              // Log Discord
              const logChannel = guild.channels.cache.get(SETTINGS.CHANNELS.LOGS_ABSENCES);
              if (logChannel) {
                  const embed = new EmbedBuilder()
                      .setTitle('📅 NOUVELLE ABSENCE')
                      .setColor('#E67E22')
                      .addFields(
                          { name: 'Staff', value: `${user}`, inline: true },
                          { name: 'Type', value: `\`${type}\``, inline: true },
                          { name: 'Dates', value: `Du **${debut}** au **${fin}**` },
                          { name: 'Raison', value: motif }
                      )
                      .setTimestamp();
                  await logChannel.send({ embeds: [embed] });
              }

              return await interaction.reply({ content: '✅ Absence enregistrée et rôle appliqué !', ephemeral: true });
          }
      }

    } catch (err) {
      logger.error(`[CRITICAL_ERROR] ${err.message}`);
      if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({ content: "⚠️ Une erreur est survenue.", ephemeral: true }).catch(() => {});
      }
    }
  }
};