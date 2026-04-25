import {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle
} from "discord.js";

// Correction du chemin : on remonte de deux niveaux pour atteindre la racine src/
import Hierarchy from "../../models/Hierarchie.js";
import { CONFIG } from "../config.js";
import { buildHierarchyEmbed } from "../utils/hierarchie.js";
import { logger } from "../../utils/logger.js";

export default {
  data: new SlashCommandBuilder()
    .setName("hierarchie")
    .setDescription("🏗️ Créer une hiérarchie interactive des rôles (persistante)"),

  async execute(interaction) {
    const member = await interaction.guild.members.fetch(interaction.user.id);
    const hasPermission = member.roles.cache.some(role =>
      CONFIG.ALLOWED_ADMIN_ROLES.includes(role.id)
    );

    if (!hasPermission) {
      return interaction.reply({
        content: "❌ Tu n'as pas la permission d'utiliser cette commande.",
        ephemeral: true
      });
    }

    let categories = [];
    let currentCat = null;
    let step = "CAT_NAME";

    await interaction.reply({
      content:
        "🏗️ **Configuration de la Hiérarchie**\n\n1. Envoie le **NOM DE LA CATÉGORIE** (ex: `👑 Direction`).\n2. Ajoute les rôles un par un.\n\nTape `cat` pour créer une autre catégorie, ou `fin` pour terminer.",
      ephemeral: true
    });

    const filter = m => m.author.id === interaction.user.id;
    const collector = interaction.channel.createMessageCollector({
      filter,
      time: 900000
    });

    collector.on("collect", async m => {
      const input = m.content.trim();

      if (input.toLowerCase() === "fin") return collector.stop("manual");

      if (input.toLowerCase() === "cat") {
        step = "CAT_NAME";
        await m.reply("🏷️ Nom de la **nouvelle catégorie** ?");
        return;
      }

      if (step === "CAT_NAME") {
        currentCat = { name: input, roles: [] };
        categories.push(currentCat);
        step = "ROLE_NAME";
        await m.reply(
          `✅ Catégorie **${input}** créée.\n\nMaintenant, envoie le **Nom du grade** (ex: Fondateur) :`
        );
      } else if (step === "ROLE_NAME") {
        currentCat.roles.push({ name: input });
        step = "ROLE_ID";
        await m.reply(`🆔 ID ou Mention du rôle pour **${input}** :`);
      } else if (step === "ROLE_ID") {
        const match = input.match(/\d+/);
        if (!match) {
          return m.reply(
            "⚠️ Format invalide. Envoie l'ID numérique du rôle (ou mentionne-le) :"
          );
        }

        const roleId = match[0];
        const roleExists = interaction.guild.roles.cache.has(roleId);

        if (!roleExists) {
          return m.reply("⚠️ Rôle introuvable. Réessaie avec un ID valide :");
        }

        currentCat.roles[currentCat.roles.length - 1].id = roleId;
        step = "ROLE_DESC";
        await m.reply(
          `📝 Description pour **${
            currentCat.roles[currentCat.roles.length - 1].name
          }** (envoie \`.\` pour ignorer) :`
        );
      } else if (step === "ROLE_DESC") {
        currentCat.roles[currentCat.roles.length - 1].description =
          input === "." ? null : input;
        step = "ROLE_NAME";
        await m.reply(
          `✅ Grade ajouté.\n\nProchain **Nom de grade** ?\n*(Ou tape \`cat\` pour changer de catégorie, ou \`fin\` pour publier)*`
        );
      }

      try {
        await m.delete();
      } catch {}
    });

    collector.on("end", async (collected, reason) => {
      if (categories.length === 0 || reason === "time") return;

      const menu = new StringSelectMenuBuilder()
        .setCustomId("select_hierarchy")
        .setPlaceholder("Choisir une section à afficher...")
        .addOptions(
          categories.map((cat, index) => ({
            label: cat.name,
            description: `Voir les membres : ${cat.name}`,
            value: `cat_${index}`
          }))
        );

      const rowMenu = new ActionRowBuilder().addComponents(menu);

      const rowBtn = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("refresh_hierarchy")
          .setLabel("Rafraîchir le cache")
          .setStyle(ButtonStyle.Secondary)
          .setEmoji("🔄")
      );

      const welcomeEmbed = new EmbedBuilder()
        .setColor(0x2b2d31)
        .setTitle("📊 Organigramme du Personnel — Nîmes RP")
        .setDescription(
          "Cliquez sur le menu ci-dessous pour afficher les membres de chaque pôle.\n\n*L'affichage sera visible uniquement pour vous.*"
        )
        .setImage(CONFIG.BANNER_GIF)
        .setFooter({
          text: CONFIG.FOOTER_TEXT,
          iconURL: CONFIG.FOOTER_ICON
        });

      const sentMsg = await interaction.channel.send({
        embeds: [welcomeEmbed],
        components: [rowMenu, rowBtn]
      });

      try {
        await Hierarchy.create({
          messageId: sentMsg.id,
          guildId: interaction.guild.id,
          categories
        });

        logger.info(`Hiérarchie sauvegardée pour message ${sentMsg.id}`);
      } catch (dbErr) {
        logger.error(dbErr, "Sauvegarde hiérarchie MongoDB");
      }
    });
  }
};
