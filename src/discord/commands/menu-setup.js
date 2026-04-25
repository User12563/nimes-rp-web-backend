import {
  SlashCommandBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder
} from "discord.js";

import { getCollabState } from "../utils/settings.js";
import { getEmbedForCategory } from "../utils/embeds.js";

export default {
  data: new SlashCommandBuilder()
    .setName("menu-setup")
    .setDescription("📋 Affiche le menu interactif"),

  async execute(interaction) {
    const collabState = await getCollabState();

    // Menu déroulant
    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId("rp_menu_select")
      .setPlaceholder("📋 Sélectionne une rubrique...")
      .addOptions(
        new StringSelectMenuOptionBuilder()
          .setLabel("Accueil")
          .setValue("accueil")
          .setEmoji("🏙️"),
        new StringSelectMenuOptionBuilder()
          .setLabel("Lexique RP")
          .setValue("lexique")
          .setEmoji("📖"),
        new StringSelectMenuOptionBuilder()
          .setLabel("Recrutement Staff")
          .setValue("recrutement")
          .setEmoji("👥"),
        new StringSelectMenuOptionBuilder()
          .setLabel("Règlement")
          .setValue("reglement")
          .setEmoji("📜"),
        new StringSelectMenuOptionBuilder()
          .setLabel("Site Web & MAJ")
          .setValue("site")
          .setEmoji("🌐"),
        new StringSelectMenuOptionBuilder()
          .setLabel("Serveurs EH")
          .setValue("serveurs")
          .setEmoji("🎮"),
        new StringSelectMenuOptionBuilder()
          .setLabel("Partenariats")
          .setValue("partenariats")
          .setEmoji("🤝"),
        new StringSelectMenuOptionBuilder()
          .setLabel("État des services")
          .setValue("etat")
          .setEmoji("🚦")
      );

    const row = new ActionRowBuilder().addComponents(selectMenu);

    // Embed par défaut (Accueil)
    const defaultEmbed = getEmbedForCategory(null, collabState);

    return interaction.reply({
      embeds: [defaultEmbed],
      components: [row]
    });
  }
};
