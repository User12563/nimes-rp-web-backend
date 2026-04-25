import { client } from "../index.js";
import { logger } from "../../utils/logger.js";

export async function getMemberRoles(userId) {
  try {
    const guildId = process.env.DISCORD_GUILD_ID || "1380978534167613611";
    const guild = await client.guilds.fetch(guildId);
    const member = await guild.members.fetch(userId);
    return member.roles.cache.map(role => role.id);
  } catch (err) {
    logger.error(`Erreur vérification rôles bot pour ${userId}: ${err.message}`);
    return [];
  }
}
