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

    client.commands.set(cmd.data.name, cmd);
    slashData.push(cmd.data.toJSON());
  }

  // -----------------------------
  // 2. Charger les events
  // -----------------------------
  const eventsPath = path.join(process.cwd(), "src/discord/events");
  const eventFiles = fs.readdirSync(eventsPath);

  for (const file of eventFiles) {
    if (!file.endsWith(".js")) continue;

    const evt = (await import(`./events/${file}`)).default;

    client.on(evt.name, (...args) => evt.execute(client, ...args));
  }

  // -----------------------------
  // 3. Déployer les commandes
  // -----------------------------
  const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_BOT_TOKEN);

  try {
    // On utilise l'ID du .env plutôt que client.user.id qui est null au démarrage
    const clientId = process.env.DISCORD_CLIENT_ID;
    const guildId = process.env.DISCORD_GUILD_ID;

    if (!clientId) {
      throw new Error("DISCORD_CLIENT_ID est manquant dans le .env");
    }

    if (guildId) {
      // Déploiement local (instantané sur ton serveur)
      await rest.put(
        Routes.applicationGuildCommands(clientId, guildId),
        { body: slashData }
      );
      console.log("✔️ Commandes slash déployées sur le serveur (Guild)");
    } else {
      // Déploiement global (si pas de Guild ID)
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
