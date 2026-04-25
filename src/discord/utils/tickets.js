import { EmbedBuilder } from "discord.js";
import { client } from "../index.js";
import { CONFIG } from "../config.js";
import { buildFooter } from "./embeds.js";
import { logger } from "../../utils/logger.js";

export async function notifyNewTicket(ticket) {
  try {
    const channel = await client.channels.fetch(CONFIG.TICKET_CHANNEL_ID);
    if (!channel) return logger.error("Salon ticket introuvable");

    const authorName = ticket.playerName || "Joueur Inconnu";
    const firstMessage = ticket.messages?.[0]?.content || "Aucun message fourni.";
    const displayMessage =
      firstMessage.length > 500 ? firstMessage.substring(0, 500) + "..." : firstMessage;

    const embed = new EmbedBuilder()
      .setColor(0x3b82f6)
      .setTitle("🎫 Nouveau Ticket Reçu")
      .setDescription("Un nouveau ticket attend une réponse.")
      .addFields(
        { name: "👤 Auteur", value: `\`${authorName}\``, inline: true },
        { name: "📌 Sujet", value: ticket.subject || "Sans sujet", inline: true },
        { name: "💬 Message", value: displayMessage }
      )
      .setFooter(buildFooter())
      .setTimestamp();

    await channel.send({
      content: `🔔 <@&${CONFIG.STAFF_ROLE_ID}>, nouveau ticket !`,
      embeds: [embed]
    });
  } catch (err) {
    logger.error(err, "notifyNewTicket");
  }
}
