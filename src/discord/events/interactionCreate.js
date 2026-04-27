import { logger } from "../../utils/logger.js";
import { getPseudoAutocomplete } from "../utils/autocomplete.js";
import { getCollabState } from "../utils/settings.js";
import { getEmbedForCategory } from "../utils/embeds.js";
import { CONFIG } from "../config.js";
import Hierarchy from "../../models/Hierarchie.js";
import Log from "../../models/Logs.js";
import StaffUser from '../../models/StaffUser.js';
import Absence from '../../models/Absence.js'; // ✅ Ajout de l'import du modèle
import { buildHierarchyEmbed } from "../utils/embeds.js";

// ✅ Ajout des imports Discord.js nécessaires pour les menus et formulaires
import { ActionRowBuilder, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, EmbedBuilder } from 'discord.js';

export default {
  name: "interactionCreate",

  async execute(client, interaction) {
    const startTime = Date.now();
    
    // Logging de l'interaction
    logger.info(
      `[INTERACTION] Type: ${interaction.type} | ID: ${
        interaction.customId || interaction.commandName
      } | User: ${interaction.user.tag}`
    );

    try {
      // 1. AUTOCOMPLÉTION
      if (interaction.isAutocomplete()) {
        if (interaction.commandName === "info") {
          const focused = interaction.options.getFocused();
          return getPseudoAutocomplete(interaction, focused);
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
        const { customId, user, member } = interaction;

        // --- LOGIQUE DE SERVICE (duty_on / duty_off) ---
        if (customId === 'duty_on' || customId === 'duty_off') {
          const staff = await StaffUser.findOne({ discordId: user.id });

          if (!staff) {
            return interaction.reply({ 
              content: "❌ Vous n'êtes pas répertorié dans la base de données staff.", 
              ephemeral: true 
            });
          }

          if (customId === 'duty_on') {
            if (staff.status === 'SERVICE') {
              return interaction.reply({ content: "⚠️ Déjà en service !", ephemeral: true });
            }
            staff.status = 'SERVICE';
            staff.currentServiceStart = new Date();
            await staff.save();
            
            try { await member.setNickname(`[SERV] ${user.username}`); } catch (e) {}
            return interaction.reply({ content: "🟢 **Service démarré.** Bon courage !", ephemeral: true });
          }

          if (customId === 'duty_off') {
            if (staff.status !== 'SERVICE') {
              return interaction.reply({ content: "⚠️ Vous n'étiez pas en service.", ephemeral: true });
            }

            const durationMs = Date.now() - (staff.currentServiceStart || Date.now());
            staff.totalServiceTime += durationMs;
            staff.weeklyServiceTime += durationMs;
            staff.status = 'OFFLINE';
            staff.currentServiceStart = null;
            staff.lastServiceEnd = new Date();
            await staff.save();

            try { await member.setNickname(user.username.replace("[SERV] ", "")); } catch (e) {}
            
            const mins = Math.floor(durationMs / 60000);
            return interaction.reply({ 
              content: `🔴 **Service terminé.** (\`${mins} min\` ajoutées)`, 
              ephemeral: true 
            });
          }
        }

        // --- BOUTON REFRESH HIÉRARCHIE ---
        if (customId === "refresh_hierarchy") {
          const hasPermission = member.roles.cache.some(role =>
            CONFIG.ALLOWED_ADMIN_ROLES.includes(role.id)
          );
          if (!hasPermission) return interaction.reply({ content: "❌ Permission insuffisante.", ephemeral: true });

          await interaction.deferReply({ ephemeral: true });
          await interaction.guild.members.fetch({ force: true });
          return interaction.editReply({ content: "✅ Cache mis à jour !" });
        }

        // --- BOUTON OUVERTURE FORMULAIRE ABSENCE ---
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

          return interaction.reply({ 
              content: 'Veuillez choisir le domaine de votre absence :', 
              components: [row], 
              ephemeral: true 
          });
        }
      }

      // 4. MENUS DÉROULANTS (Select Menus)
      if (interaction.isStringSelectMenu()) {
        const { customId, values } = interaction;

        // --- MENU TYPE D'ABSENCE ---
        if (customId === 'select_absence_type') {
            const type = values[0];

            const modal = new ModalBuilder()
                .setCustomId(`modal_absence|${type}`)
                .setTitle('Formulaire d\'absence');

            modal.addComponents(
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('date_debut')
                        .setLabel("Date de début (JJ/MM)")
                        .setStyle(TextInputStyle.Short)
                        .setPlaceholder('Ex: 12/05')
                        .setRequired(true)
                ),
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('date_fin')
                        .setLabel("Date de fin (JJ/MM)")
                        .setStyle(TextInputStyle.Short)
                        .setPlaceholder('Ex: 15/05')
                        .setRequired(true)
                ),
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('motif')
                        .setLabel("Motif de l'absence")
                        .setStyle(TextInputStyle.Paragraph)
                        .setPlaceholder('Expliquez la raison...')
                        .setRequired(true)
                )
            );

            return await interaction.showModal(modal);
        }

        // --- MENU RP ---
        if (customId === "rp_menu_select") {
          const collabState = await getCollabState();
          let selected = values[0] === "accueil" ? null : values[0];
          return interaction.reply({ embeds: [getEmbedForCategory(selected, collabState)], ephemeral: true });
        }

        // --- MENU HIÉRARCHIE ---
        if (customId === "select_hierarchy") {
          await interaction.deferReply({ ephemeral: true });
          const config = await Hierarchy.findOne({ messageId: interaction.message.id });
          const index = parseInt(values[0].split("_")[1]);
          const targetCat = config?.categories[index];
          if (!targetCat) return interaction.editReply({ content: "❌ Catégorie introuvable." });

          const embed = await buildHierarchyEmbed(interaction.guild, targetCat.name, targetCat.roles);
          return interaction.editReply({ embeds: [embed] });
        }

        // --- MENU JUSTIFICATION ---
        if (customId === 'select_justification') {
          const [logId, raison] = values[0].split('|');
          const log = await Log.findById(logId);
          if (!log) return interaction.update({ content: "❌ Log introuvable.", components: [] });

          log.category = "JUSTIFIÉ";
          log.action = `[JUSTIFIÉ] ${raison}`;
          log.raw = `RAISON : ${raison} | ${log.raw}`;
          await log.save();

          return interaction.update({ content: `✅ Sanction sur **${log.target}** justifiée !`, components: [] });
        }
      }

      // 5. SOUMISSION DES FORMULAIRES (Modals)
      if (interaction.isModalSubmit()) {
          // --- MODAL ABSENCE ---
          if (interaction.customId.startsWith('modal_absence')) {
              const type = interaction.customId.split('|')[1];
              const debut = interaction.fields.getTextInputValue('date_debut');
              const fin = interaction.fields.getTextInputValue('date_fin');
              const motif = interaction.fields.getTextInputValue('motif');

              // On enregistre dans la collection Absences
              await Absence.create({
                  discordId: interaction.user.id,
                  username: interaction.user.username,
                  type: type,
                  startDate: debut,
                  endDate: fin,
                  reason: motif
              });

              // Envoi du log aux admins (⚠️ RENSEIGNE TON ID ICI)
              const logChannel = interaction.guild.channels.cache.get("1494594500511924425");
              if (logChannel) {
                  const embed = new EmbedBuilder()
                      .setTitle('📅 NOUVELLE ABSENCE')
                      .setColor('#E67E22')
                      .addFields(
                          { name: 'Staff', value: `${interaction.user}`, inline: true },
                          { name: 'Type', value: `\`${type}\``, inline: true },
                          { name: 'Dates', value: `Du **${debut}** au **${fin}**` },
                          { name: 'Raison', value: motif }
                      );
                  await logChannel.send({ embeds: [embed] });
              }

              return await interaction.reply({ content: '✅ Absence enregistrée avec succès !', ephemeral: true });
          }
      }

    } catch (err) {
      logger.error(`[CRITICAL_ERROR] Interaction: ${interaction.customId || interaction.commandName} | ${err.message}`);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ content: "⚠️ Erreur critique.", ephemeral: true });
      }
    }
  }
};