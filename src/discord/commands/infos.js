import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import Log from "../../models/Logs.js";
import { getRobloxUser, formatAuthorLink } from "../utils/roblox.js";
import { getPseudoAutocomplete } from "../utils/autocomplete.js";
import { buildFooter } from "../utils/embeds.js";
import { logger } from "../../utils/logger.js";

export default {
  data: new SlashCommandBuilder()
    .setName("info")
    .setDescription("🔍 Recherche un joueur (ban/kick/unban)")
    .addStringOption(option =>
      option
        .setName("pseudo")
        .setDescription("Pseudo du joueur")
        .setRequired(true)
        .setAutocomplete(true)
    ),

  // 🔵 Autocomplétion
  async autocomplete(interaction) {
    const focused = interaction.options.getFocused();
    return getPseudoAutocomplete(interaction, focused);
  },

  // 🔵 Exécution de la commande
  async execute(interaction) {
    await interaction.deferReply({ ephemeral: false });
    const pseudo = interaction.options.getString("pseudo");

    try {
      const robloxUser = await getRobloxUser(pseudo);
      const searchPseudo = robloxUser ? robloxUser.name : pseudo;

      const sanctions = await Log.find({
        $and: [
          {
            $or: [
              { target: { $regex: new RegExp(searchPseudo, "i") } },
              { raw: { $regex: new RegExp(searchPseudo, "i") } }
            ]
          },
          {
            $or: [
              { type: { $regex: /ban|kick|unban/i } },
              { action: { $regex: /ban|kick|unban/i } },
              { raw: { $regex: /ban|kick|unban/i } }
            ]
          }
        ]
      })
        .sort({ createdAt: -1 })
        .limit(30)
        .lean();

      const bans = sanctions.filter(s =>
        /ban/i.test(s.type || s.action || s.raw)
      );
      const kicks = sanctions.filter(s =>
        /kick/i.test(s.type || s.action || s.raw)
      );
      const unbans = sanctions.filter(s =>
        /unban/i.test(s.type || s.action || s.raw)
      );

      const embed = new EmbedBuilder()
        .setColor(0x0099ff)
        .setTitle(`🔍 Fiche joueur — ${searchPseudo}`)
        .setThumbnail(
          robloxUser
            ? `https://www.roblox.com/headshot-thumbnail/image?userId=${robloxUser.id}&width=420&height=420&format=png`
            : null
        )
        .setDescription(
          robloxUser
            ? `**[${robloxUser.displayName} (${robloxUser.name})](https://www.roblox.com/users/${robloxUser.id}/profile)**\n🆔 ID : \`${robloxUser.id}\``
            : `👤 **${searchPseudo}**`
        )
        .addFields(
          {
            name: "🚫 Bans",
            value: bans.length ? `**${bans.length}**` : "Aucun",
            inline: true
          },
          {
            name: "👢 Kicks",
            value: kicks.length ? `**${kicks.length}**` : "Aucun",
            inline: true
          },
          {
            name: "🔓 Unbans",
            value: unbans.length ? `**${unbans.length}**` : "Aucun",
            inline: true
          }
        )
        .setFooter(buildFooter())
        .setTimestamp();

      const allSanctions = [...bans, ...kicks, ...unbans].slice(0, 25);

      if (allSanctions.length > 0) {
        const lines = await Promise.all(
          allSanctions.map(async (s, idx) => {
            const date = new Date(s.createdAt).toLocaleDateString("fr-FR");
            const type =
              (
                s.type ||
                (s.action || s.raw).match(/ban|kick|unban/i)?.[0] ||
                "sanction"
              ).toUpperCase();

            const author = await formatAuthorLink(s.author);

            let reason = "";

            if (s.action) {
              reason = s.action;
            } else if (s.raw) {
              const cleaned = s.raw
                .split("\n")
                .filter(line => {
                  const l = line.toLowerCase();
                  return (
                    !l.includes("target") &&
                    !l.includes("author") &&
                    !l.includes("action")
                  );
                })
                .join(" ")
                .trim();

              let cleanReason = cleaned;

              if (
                author &&
                author !== "Inconnu" &&
                cleanReason.startsWith(author)
              ) {
                cleanReason = cleanReason.slice(author.length).trim();
              }

              if (
                searchPseudo &&
                cleanReason
                  .toLowerCase()
                  .startsWith(searchPseudo.toLowerCase())
              ) {
                cleanReason = cleanReason.slice(searchPseudo.length).trim();
              }

              reason = cleanReason;
            }

            if (!reason) reason = "Non précisée";
            if (reason.length > 150) reason = reason.slice(0, 150) + "…";

            return `**${idx + 1}.** ${date} — **${type}** par ${author}\n   *Raison :* ${reason}`;
          })
        );

        embed.addFields({
          name: "📋 Détails des sanctions",
          value: lines.join("\n\n").slice(0, 1024)
        });
      }

      await interaction.editReply({ embeds: [embed] });
    } catch (err) {
      logger.error(err, `handleInfoCommand(${pseudo})`);
      await interaction.editReply("❌ Erreur lors de la recherche.");
    }
  }
};
