import { SlashCommandBuilder, EmbedBuilder, PermissionsBitField } from "discord.js";
import { getCollabState, setCollabState } from "../utils/settings.js";
import { saveLogAndNotify } from "../utils/logs.js";
import { buildFooter } from "../utils/embeds.js";
import { CONFIG } from "../config.js";

export default {
  data: new SlashCommandBuilder()
    .setName("fermer-collab")
    .setDescription("🔒 Basculer l'état Ouvert/Fermé des partenariats"),

  async execute(interaction) {
    const member = await interaction.guild.members.fetch(interaction.user.id);

    const hasPermission =
      member.roles.cache.has(CONFIG.STAFF_ROLE_ID) ||
      member.roles.cache.has(CONFIG.COLLAB_MANAGER_ROLE_ID) ||
      member.permissions.has(PermissionsBitField.Flags.Administrator);

    if (!hasPermission) {
      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xed4245)
            .setTitle("🚫 Permission refusée")
            .setDescription("Tu n'as pas les droits.")
            .setFooter(buildFooter())
            .setTimestamp()
        ],
        ephemeral: true
      });
    }

    const currentState = await getCollabState();
    const newState = currentState === "Ouvert" ? "Fermé" : "Ouvert";
    await setCollabState(newState);

    const isNowOpen = newState === "Ouvert";

    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(isNowOpen ? 0x57f287 : 0xed4245)
          .setTitle("🔄 État des partenariats mis à jour")
          .setDescription(
            `Ancien état : **${currentState}**\nNouvel état : ${
              isNowOpen ? "🟢 **OUVERT**" : "🔴 **FERMÉ**"
            }`
          )
          .addFields({
            name: "👤 Modifié par",
            value: `<@${interaction.user.id}> (\`${interaction.user.tag}\`)`,
            inline: true
          })
          .setFooter(buildFooter())
          .setTimestamp()
      ]
    });

    await saveLogAndNotify({
      type: "mod_change",
      target: "SYSTEM",
      author: interaction.user.tag,
      action: "TOGGLE_COLLAB",
      category: "STAFF",
      raw: `${interaction.user.tag} a passé l'état des partenariats à ${newState}`,
      discordMessageId: interaction.id
    });
  }
};
