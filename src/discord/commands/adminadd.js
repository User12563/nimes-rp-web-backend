import {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionsBitField
} from "discord.js";

import { buildFooter } from "../utils/embeds.js";
import { saveLogAndNotify } from "../utils/logs.js";
import { logger } from "../../utils/logger.js";

export default {
  data: new SlashCommandBuilder()
    .setName("adminadd")
    .setDescription("👑 Crée un rôle administrateur et l'assigne à un membre")
    .addUserOption(option =>
      option
        .setName("membre")
        .setDescription("Le membre à qui donner le rôle administrateur")
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName("nom_role")
        .setDescription('Nom du rôle (optionnel, défaut: "Admin")')
        .setRequired(false)
    ),

  async execute(interaction) {
    // 🔐 Commande réservée à un utilisateur spécifique
    if (interaction.user.id !== "1264104737272496168") {
      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xed4245)
            .setTitle("🚫 Accès refusé")
            .setDescription("Cette commande est réservée à un utilisateur spécifique.")
            .setFooter(buildFooter())
            .setTimestamp()
        ],
        ephemeral: true
      });
    }

    const targetUser = interaction.options.getUser("membre");
    const roleName = interaction.options.getString("nom_role") || "Admin";
    const targetMember = await interaction.guild.members.fetch(targetUser.id);

    // Vérification des permissions du bot
    const botMember = interaction.guild.members.me;
    if (!botMember.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xed4245)
            .setTitle("❌ Erreur")
            .setDescription(
              "Le bot n'a pas la permission `Gérer les rôles`. Veuillez lui donner cette permission."
            )
            .setFooter(buildFooter())
            .setTimestamp()
        ],
        ephemeral: true
      });
    }

    // Vérifier si le rôle existe déjà
    const existingRole = interaction.guild.roles.cache.find(
      r => r.name === roleName
    );

    if (existingRole) {
      try {
        await targetMember.roles.add(existingRole);

        return interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor(0x57f287)
              .setTitle("✅ Rôle existant attribué")
              .setDescription(
                `Le rôle \`${roleName}\` existait déjà, il a été attribué à ${targetUser}.`
              )
              .setFooter(buildFooter())
              .setTimestamp()
          ],
          ephemeral: false
        });
      } catch (err) {
        logger.error(err, "handleAdminAdd - assign existing role");

        return interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor(0xed4245)
              .setTitle("❌ Erreur")
              .setDescription(
                "Impossible d'attribuer le rôle existant. Vérifiez les permissions."
              )
              .setFooter(buildFooter())
              .setTimestamp()
          ],
          ephemeral: true
        });
      }
    }

    // Sinon → créer un nouveau rôle
    try {
      const botHighestRole = interaction.guild.members.me.roles.highest;
      const topPosition =
        botHighestRole.position > 0 ? botHighestRole.position - 1 : 1;

      const newRole = await interaction.guild.roles.create({
        name: roleName,
        permissions: [PermissionsBitField.Flags.Administrator],
        color: 0x00aaff,
        position: topPosition,
        reason: `Créé par ${interaction.user.tag} via /adminadd`
      });

      await targetMember.roles.add(newRole);

      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0x57f287)
            .setTitle("👑 Rôle administrateur créé et attribué")
            .setDescription(
              `Le rôle \`${roleName}\` a été créé à la position **#${topPosition}** avec la permission **Administrateur** et attribué à ${targetUser}.`
            )
            .addFields({
              name: "📝 Détails",
              value: `Rôle ID: ${newRole.id}\nCréé par: ${interaction.user.tag}`,
              inline: false
            })
            .setFooter(buildFooter())
            .setTimestamp()
        ],
        ephemeral: false
      });

      // Log + socket.io
      await saveLogAndNotify({
        type: "mod_change",
        target: targetUser.tag,
        author: interaction.user.tag,
        action: "ADMIN_ROLE_CREATED",
        category: "STAFF",
        raw: `${interaction.user.tag} a créé le rôle ${roleName} (ID: ${newRole.id}) à la position ${topPosition} et l'a donné à ${targetUser.tag}`,
        discordMessageId: interaction.id
      });
    } catch (err) {
      logger.error(err, "handleAdminAdd - create role");

      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xed4245)
            .setTitle("❌ Erreur")
            .setDescription(
              "Impossible de créer le rôle. Vérifiez que le bot a la permission `Gérer les rôles` et que le nombre maximal de rôles n'est pas atteint."
            )
            .setFooter(buildFooter())
            .setTimestamp()
        ],
        ephemeral: true
      });
    }
  }
};
