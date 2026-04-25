import { EmbedBuilder } from "discord.js";
import { CONFIG } from "../config.js";

export async function buildHierarchyEmbed(guild, categoryName, rolesInCat) {
  await guild.fetch();
  await guild.members.fetch();

  const embed = new EmbedBuilder()
    .setColor(0x2b2d31)
    .setTitle(`📊 Hiérarchie — ${categoryName}`)
    .setDescription(
      `Voici les membres de la catégorie **${categoryName}**.\n*Mise à jour : <t:${Math.floor(
        Date.now() / 1000
      )}:R>*`
    )
    .setThumbnail(guild.iconURL({ dynamic: true }) || CONFIG.THUMBNAIL_GIF)
    .setFooter({
      text: "Nîmes RP — Système de Hiérarchie",
      iconURL: CONFIG.FOOTER_ICON
    })
    .setTimestamp();

  for (const roleData of rolesInCat) {
    const role = guild.roles.cache.get(roleData.id);

    let membersText = "*Aucun membre*";
    if (role) {
      const memberNames = role.members.map(m => `<@${m.id}>`);
      membersText = memberNames.length ? memberNames.join("\n") : "*Aucun membre*";
    } else {
      membersText = "*Rôle supprimé ou introuvable*";
    }

    const description =
      roleData.description && roleData.description !== "."
        ? `\n\n*${roleData.description}*`
        : "";

    const icon = roleData.name.toLowerCase().includes("fondateur")
      ? "👑"
      : roleData.name.toLowerCase().includes("admin")
      ? "🛡️"
      : roleData.name.toLowerCase().includes("mod")
      ? "🔰"
      : "👥";

    embed.addFields({
      name: `${icon} ${roleData.name} — <@&${roleData.id}>`,
      value: `${description}\n\n**Membres :**\n${membersText}`,
      inline: false
    });
  }

  return embed;
}
