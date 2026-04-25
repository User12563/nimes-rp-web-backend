import fs from "fs";
import path from "path";
import { REST, Routes } from "discord.js";
import dotenv from "dotenv";
dotenv.config();

export default async function loadBot(client) {
  client.commands = new Map();

  // -----------------------------
  // 1. Charger les commandes
  // -----------------------------
  const commandsPath = path.join(process.cwd(), "src/discord/commands");
  const commandFiles = fs.readdirSync(commandsPath);

  const slashData = [];

  for (const file of commandFiles) {
    if (!file.endsWith(".js")) continue;

    const cmd = (await import(`./commands/${file}`)).default;
    if (cmd && cmd.data) {
      client.commands.set(cmd.data.name, cmd);
      slashData.push(cmd.data.toJSON());
    }
  }

  // -----------------------------
  // 2. Charger les events
  // -----------------------------
  const eventsPath = path.join(process.cwd(), "src/discord/events");
  const eventFiles = fs.readdirSync(eventsPath);

  for (const file of eventFiles) {
    if (!file.endsWith(".js")) continue;

    const evt = (await import(`./events/${file}`)).default;
    if (evt && evt.name) {
      client.on(evt.name, (...args) => evt.execute(client, ...args));
    }
  }

  // -----------------------------
  // 3. Déployer les commandes
  // -----------------------------
  const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_BOT_TOKEN);

  try {
    const clientId = process.env.DISCORD_CLIENT_ID || process.env.CLIENT_ID;
    const guildId = process.env.DISCORD_GUILD_ID || process.env.GUILD_ID;

    if (!clientId) {
      console.error("❌ DISCORD_CLIENT_ID est manquant dans le .env");
      return;
    }

    // --- NETTOYAGE DES DOUBLONS ---
    // On vide les commandes globales pour ne garder que celles du serveur
    await rest.put(Routes.applicationCommands(clientId), { body: [] });
    console.log("🧹 Commandes globales nettoyées (évite les doublons)");

    if (guildId) {
      // Déploiement sur ton serveur spécifique (Instantané)
      await rest.put(
        Routes.applicationGuildCommands(clientId, guildId),
        { body: slashData }
      );
      console.log(`✔️ Commandes slash déployées sur le serveur : ${guildId}`);
    } else {
      // Si pas de Guild ID, on déploie en global
      await rest.put(
        Routes.applicationCommands(clientId),
        { body: slashData }
      );
      console.log("✔️ Commandes slash déployées globalement");
    }

  } catch (err) {
    console.error("❌ Erreur déploiement commandes :", err);
  }
}