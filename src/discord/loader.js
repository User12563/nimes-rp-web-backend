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
    await rest.put(
      Routes.applicationCommands(client.user.id),
      { body: slashData }
    );

    console.log("✔️ Commandes slash déployées");
  } catch (err) {
    console.error("❌ Erreur déploiement commandes :", err);
  }
}
