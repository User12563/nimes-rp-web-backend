import { EmbedBuilder } from "discord.js";
import { CONFIG } from "../config.js";

export function buildFooter() {   // ✅ EXPORT AJOUTÉ ICI
  return { text: CONFIG.FOOTER_TEXT, iconURL: CONFIG.FOOTER_ICON };
}

export function getEmbedForCategory(category, collabState) {
  const ts = new Date();

  switch (category) {
    case null:
    case undefined:
      return new EmbedBuilder()
        .setColor(0x2b2d31)
        .setTitle("🚨 Emergency Hamburg — Nîmes RP")
        .setDescription("> Bienvenue sur le serveur RP Nîmes.\n\n📌 Utilise le menu ci-dessous.")
        .setImage(CONFIG.BANNER_GIF)
        .addFields(
          { name: "📖 Lexique", value: "Apprends les bases", inline: true },
          { name: "👥 Recrutement", value: "Rejoins le staff", inline: true },
          { name: "📜 Règlement", value: "Les règles", inline: true },
          { name: "🌐 Site & MAJ", value: "Site et annonces", inline: true },
          { name: "🎮 Serveurs", value: "Comment rejoindre", inline: true },
          { name: "🤝 Partenariats", value: "État des demandes", inline: true }
        )
        .setFooter(buildFooter())
        .setTimestamp(ts);

    case "lexique":
      return new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle("📖 Lexique RP")
        .setThumbnail(CONFIG.THUMBNAIL_GIF)
        .setDescription("> Maîtrise le vocabulaire du RP.")
        .addFields(
          { name: "🚫 No-Fear", value: "Interdit de ne pas craindre une menace létale.", inline: false },
          { name: "🩸 Pain RP", value: "Simuler la douleur.", inline: false },
          { name: "😨 Fear RP", value: "Obligation de peur sous menace.", inline: false },
          { name: "🧠 Meta-Gaming", value: "Utiliser des infos hors jeu = interdit.", inline: false }
        )
        .setFooter(buildFooter())
        .setTimestamp(ts);

    case "recrutement":
      return new EmbedBuilder()
        .setColor(0x57F287)
        .setTitle("👥 Recrutement Staff")
        .setThumbnail(CONFIG.THUMBNAIL_GIF)
        .setDescription("> Rejoins l’équipe.")
        .addFields(
          { name: "✅ Prérequis", value: "— Connaissance d’EH\n— Actif ≥5h/semaine\n— Micro\n— Aucune sanction", inline: false },
          { name: "📬 Postuler", value: "👉 <#1460677849076859157>", inline: false }
        )
        .setFooter(buildFooter())
        .setTimestamp(ts);

    case "reglement":
      return new EmbedBuilder()
        .setColor(0xED4245)
        .setTitle("📜 Règlement")
        .setThumbnail(CONFIG.THUMBNAIL_GIF)
        .setDescription("> En rejoignant, tu acceptes le règlement.")
        .addFields(
          { name: "🤝 Respect", value: "Obligatoire.", inline: false },
          { name: "🔫 DM / RDM", value: "Toute attaque doit être RP. RDM = ban.", inline: false },
          { name: "📌 Complet", value: "<#1381159398935887923>", inline: false }
        )
        .setFooter(buildFooter())
        .setTimestamp(ts);

    case "site":
      return new EmbedBuilder()
        .setColor(0xFEE75C)
        .setTitle("🌐 Site & MAJ")
        .setThumbnail(CONFIG.THUMBNAIL_GIF)
        .addFields(
          { name: "🔗 Site", value: "[nimes-rp-web-frontend.vercel.app](https://nimes-rp-web-frontend.vercel.app)", inline: false },
          { name: "📢 MAJ", value: "<#1487528322568028320>", inline: false }
        )
        .setFooter(buildFooter())
        .setTimestamp(ts);

    case "serveurs":
      return new EmbedBuilder()
        .setColor(0xEB459E)
        .setTitle("🎮 Rejoindre EH")
        .setThumbnail(CONFIG.THUMBNAIL_GIF)
        .addFields(
          { name: "🟢 Serveur principal", value: 'Recherche "Nîmes RP" dans les serveurs privés.', inline: false },
          { name: "🟡 Serveur secondaire", value: "Code : `FERME`", inline: false }
        )
        .setFooter(buildFooter())
        .setTimestamp(ts);

    case "partenariats": {
      const isOpen = collabState === "Ouvert";
      return new EmbedBuilder()
        .setColor(isOpen ? 0x57F287 : 0xED4245)
        .setTitle("🤝 Partenariats")
        .setThumbnail(CONFIG.THUMBNAIL_GIF)
        .setDescription(`État : **${isOpen ? "OUVERT" : "FERMÉ"}**`)
        .addFields({
          name: "📬 Postuler",
          value: isOpen ? "👉 <#1461015007046144216>" : "⛔ Fermé.",
          inline: false
        })
        .setFooter(buildFooter())
        .setTimestamp(ts);
    }

    case "etat": {
      const isOpen = collabState === "Ouvert";
      return new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle("🚦 État des services")
        .setThumbnail(CONFIG.THUMBNAIL_GIF)
        .addFields(
          { name: "🤖 Bot", value: "🟢 OK", inline: true },
          { name: "🌐 Site", value: "🟢 En ligne", inline: true },
          { name: "🎮 Serveur", value: "🟢 En ligne", inline: true },
          { name: "🤝 Partenariats", value: isOpen ? "🟢 Ouvert" : "🔴 Fermé", inline: true }
        )
        .setFooter(buildFooter())
        .setTimestamp(ts);
    }

    default:
      return new EmbedBuilder()
        .setColor(0x2b2d31)
        .setTitle("Menu RP")
        .setDescription("Choix invalide.")
        .setFooter(buildFooter())
        .setTimestamp(ts);
  }
}


export function buildHierarchyEmbed(category, guild) {
  const ts = new Date();

  const embed = new EmbedBuilder()
    .setColor(0x2b2d31)
    .setTitle(`📌 ${category.name}`)
    .setThumbnail(CONFIG.THUMBNAIL_GIF)
    .setFooter(buildFooter())
    .setTimestamp(ts);

  if (!category.roles || category.roles.length === 0) {
    return embed.setDescription("Aucun grade enregistré dans cette catégorie.");
  }

  for (const role of category.roles) {
    const discordRole = guild.roles.cache.get(role.id);

    const roleName = discordRole ? discordRole.name : role.name;
    const memberCount = discordRole ? discordRole.members.size : 0;

    embed.addFields({
      name: `🎖️ ${roleName}`,
      value:
        `👥 **${memberCount} membre(s)**\n` +
        (role.description ? `📝 ${role.description}` : "_Aucune description_"),
      inline: false
    });
  }

  return embed;
}
