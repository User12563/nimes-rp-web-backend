import Log from "../../models/Logs.js";
import StaffUser from "../../models/StaffUser.js";
import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import { logger } from "../../utils/logger.js";
import { client } from "../index.js";

export async function saveLogAndNotify(logData) {
  try {
    const log = await Log.create(logData);

    // Socket.io
    if (client.io) {
      client.io.to("logs").emit("new_log", log);

      // Si ban/kick → demander justification
      if (log.type === "ban" || log.type === "kick") {
        const staff = await StaffUser.findOne({
          robloxUsername: { $regex: new RegExp(`^${log.author}$`, "i") }
        });

        if (staff) {
          client.io.to(staff.discordId).emit("request_justification", {
            logId: log._id,
            target: log.target,
            type: log.type,
            createdAt: log.createdAt
          });

          try {
            const discordUser = await client.users.fetch(staff.discordId);

            const embed = new EmbedBuilder()
              .setColor(0xFFA500)
              .setTitle("⚠️ Justification Requise")
              .setDescription(
                `Tu viens de sanctionner **${log.target}** (${log.type.toUpperCase()}).\n\nMerci de cliquer sur le bouton ci-dessous pour justifier ton action sur le panel.`
              )
              .addFields({
                name: "Délai",
                value: "Tu as **3 heures** avant que tes supérieurs ne soient notifiés."
              })
              .setFooter({ text: "Nîmes RP — Système de Responsabilisation" })
              .setTimestamp();

            const row = new ActionRowBuilder().addComponents(
              new ButtonBuilder()
                .setLabel("Justifier sur le Panel")
                .setStyle(ButtonStyle.Link)
                .setURL("https://www.nimesrp.fr/dashboard/logs")
            );

            await discordUser.send({ embeds: [embed], components: [row] });
          } catch (dmErr) {
            logger.error(`Impossible d'envoyer le MP à ${staff.username}: ${dmErr.message}`);
          }
        }
      }
    }

    return log;
  } catch (err) {
    logger.error(err, "saveLogAndNotify");
    throw err;
  }
}
