import { logger } from "../../utils/logger.js";
import { getPseudoAutocomplete } from "../utils/autocomplete.js";
import { getCollabState } from "../utils/settings.js";
import { getEmbedForCategory } from "../utils/embeds.js";
import { CONFIG } from "../config.js";
import Hierarchy from "../../models/Hierarchy.js";
import { buildHierarchyEmbed } from "../utils/embeds.js";

export default {
  name: "interactionCreate",

  async execute(client, interaction) {
    const startTime = Date.now();
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

      // 3. MENU RP GÉNÉRAL
      if (interaction.isStringSelectMenu() && interaction.customId === "rp_menu_select") {
        const collabState = await getCollabState();
        let selected = interaction.values[0];
        if (selected === "accueil") selected = null;

        const embed = getEmbedForCategory(selected, collabState);
        return interaction.reply({ embeds: [embed], ephemeral: true });
      }

      // 4. HIÉRARCHIE (MONGODB)
      if (
        interaction.customId === "select_hierarchy" ||
        interaction.customId === "refresh_hierarchy"
      ) {
        const dbStart = Date.now();
        const config = await Hierarchy.findOne({ messageId: interaction.message.id });

        logger.info(
          `[DB_CHECK] Temps de réponse MongoDB: ${Date.now() - dbStart}ms`
        );

        if (!config) {
          logger.warn(
            `[HIERARCHY] Config introuvable pour le message ${interaction.message.id}`
          );
          return interaction.reply({
            content: "❌ Configuration introuvable. Relancez `/hierarchie`.",
            ephemeral: true
          });
        }

        // Menu déroulant
        if (interaction.isStringSelectMenu() && interaction.customId === "select_hierarchy") {
          await interaction.deferReply({ ephemeral: true });

          const index = parseInt(interaction.values[0].split("_")[1]);
          if (isNaN(index)) {
            return interaction.editReply({
              content: "❌ Erreur de lecture de la catégorie."
            });
          }

          const targetCat = config.categories[index];
          if (!targetCat) {
            return interaction.editReply({ content: "❌ Catégorie introuvable." });
          }

          const embed = await buildHierarchyEmbed(
            interaction.guild,
            targetCat.name,
            targetCat.roles
          );

          logger.info(
            `[HIERARCHY] Affichage réussi de ${targetCat.name} en ${
              Date.now() - startTime
            }ms`
          );

          return interaction.editReply({ embeds: [embed] });
        }

        // Bouton rafraîchir
        if (interaction.isButton() && interaction.customId === "refresh_hierarchy") {
          const member = await interaction.guild.members.fetch(interaction.user.id);
          const hasPermission = member.roles.cache.some(role =>
            CONFIG.ALLOWED_ADMIN_ROLES.includes(role.id)
          );

          if (!hasPermission) {
            return interaction.reply({
              content: "❌ Seul un responsable peut rafraîchir le cache.",
              ephemeral: true
            });
          }

          await interaction.deferReply({ ephemeral: true });

          try {
            await interaction.guild.members.fetch({ force: true });
            logger.info(`[CACHE] Rafraîchissement forcé par ${interaction.user.tag}`);
            return interaction.editReply({
              content: "✅ Cache des membres mis à jour avec succès !"
            });
          } catch (error) {
            logger.error(`[CACHE_ERROR] ${error.message}`);
            return interaction.editReply({
              content: "❌ Erreur lors du rafraîchissement."
            });
          }
        }
      }
    } catch (err) {
      logger.error(
        `[CRITICAL_ERROR] Interaction: ${
          interaction.customId || interaction.commandName
        } | Error: ${err.message}`
      );

      try {
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({
            content: "⚠️ Une erreur critique est survenue.",
            ephemeral: true
          });
        } else if (interaction.deferred) {
          await interaction.editReply({
            content: "⚠️ Une erreur est survenue lors du traitement."
          });
        }
      } catch {}
    }
  }
};
