import Log from "../../models/Logs.js";
import { cleanMarkdown } from "../utils/text.js";
import { saveLogAndNotify } from "../utils/logs.js";
import { logger } from "../../utils/logger.js";
import { CONFIG } from "../config.js";

export default {
  name: "messageCreate",

  async execute(client, message) {
    try {
      // 1. Filtrage de sécurité
      if (message.author.id === client.user.id) return;
      if (message.channel.id !== CONFIG.LOG_CHANNEL_ID) return;

      // 2. Extraction du contenu (texte + embeds)
      let content = message.content || "";

      if (message.embeds?.length) {
        message.embeds.forEach(embed => {
          if (embed.description) content += "\n" + embed.description;
          if (embed.fields)
            content +=
              "\n" +
              embed.fields.map(f => `${f.name}\n${f.value}`).join("\n");
        });
      }

      if (!content.trim()) return;

      // 3. Éviter les doublons
      const exists = await Log.findOne({ discordMessageId: message.id });
      if (exists) return;

      // 4. Parsing intelligent
      const lines = content
        .split("\n")
        .map(l => l.trim())
        .filter(l => l);

      const category = lines[0] || "Autre";

      let target = "Inconnu",
        author = "Système",
        action = "Action inconnue";

      lines.forEach((line, idx) => {
        const lower = line.toLowerCase();

        if (lower.includes("target") && lines[idx + 1])
          target = cleanMarkdown(lines[idx + 1]);

        if (lower.includes("author") && lines[idx + 1])
          author = cleanMarkdown(lines[idx + 1]);

        if (lower.includes("action") && lines[idx + 1])
          action = cleanMarkdown(lines[idx + 1]);
      });

      // 5. Détermination du type
      let type = "other";
      const a = action.toLowerCase();
      const c = category.toLowerCase();

      if (a.includes("unban")) type = "unban";
      else if (a.includes("ban")) type = "ban";
      else if (a.includes("kick")) type = "kick";
      else if (c.includes("vehicle") || a.includes("car")) type = "vehicle";
      else if (a.includes("shut down") || c.includes("shutdown"))
        type = "shutdown";
      else if (
        c.includes("time") ||
        c.includes("access") ||
        a.includes("permission") ||
        c.includes("mod_change")
      )
        type = "mod_change";

      // 6. Sauvegarde + notifications
      const savedLog = await saveLogAndNotify({
        discordMessageId: message.id,
        type,
        target,
        author,
        action,
        category,
        raw: content,
        adminNotified: false
      });

      // 7. Envoi temps réel au dashboard
      if (client.io && savedLog) {
        client.io.emit("new_log", savedLog);
      }
    } catch (err) {
      logger?.error(err, "messageCreate") ||
        console.error("Erreur listener logs Discord:", err);
    }
  }
};
