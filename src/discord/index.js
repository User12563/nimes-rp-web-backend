import { Client, GatewayIntentBits } from "discord.js";
import dotenv from "dotenv";
import loadBot from "./loader.js";   // <-- IMPORTANT
dotenv.config();

export const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ]
});

export function initBot(io) {
  client.io = io; // socket.io attaché au client

  client.once("ready", () => {
    console.log(`🤖 Bot connecté en tant que ${client.user.tag}`);
  });

  // Charge commandes + events
  loadBot(client);   // <-- ESSENTIEL

  client.login(process.env.DISCORD_BOT_TOKEN);
}
