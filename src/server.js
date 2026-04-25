import dotenv from "dotenv";
dotenv.config();

import express from "express";
import helmet from "helmet";
import cors from "cors";
import http from "http";
import { Server } from "socket.io";
import mongoose from "mongoose";
import morgan from "morgan";
import passport from "passport";
import session from "express-session";
import MongoStore from "connect-mongo";
import cron from "node-cron";

import { logger } from "./utils/logger.js";
import { apiLimiter } from "./middleware/rateLimit.js";
import { errorHandler } from "./middleware/errorHandler.js";

// --- MODELS ---
import Log from "./models/Logs.js";
import StaffUser from "./models/StaffUser.js";

// --- DISCORD IMPORT (Fixé ici) ---
import { initBot, client as discordClient } from "./discord/index.js";

// --- ROUTES IMPORTS ---
import authRoutes from "./routes/auth.js";
import staffRoutes from "./routes/staff.js";
import logsRoutes from "./routes/logs.js";
import logsStatsRoutes from "./routes/logs-stats.js";
import ticketsRoutes from "./routes/tickets.js";
import serverRoutes from "./routes/server.js";
import notificationRoutes from "./routes/notifications.js";
import shadowRoutes from "./routes/shadow.js";

const app = express();
const mongoUri = (process.env.MONGO_URI || "").trim();

if (!mongoUri) {
  logger.error("MONGO_URI non défini. Vérifie tes variables d'environnement.");
  process.exit(1);
}

const allowedOrigins = [
  process.env.FRONTEND_URL || "http://localhost:5173",
  "https://www.nimesrp.fr",
  "https://nimesrp.fr"
];

app.set("trust proxy", 1);
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error("CORS policy: origine non autorisée"));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"]
  })
);

app.use(express.json());
app.use(morgan("dev"));

const isProd = process.env.NODE_ENV === "production";

app.use(
  session({
    name: process.env.SESSION_NAME || "nimes_session_prod",
    secret: process.env.SESSION_SECRET || "nimes_rp_secret_ultra_safe",
    resave: false,
    saveUninitialized: false,
    proxy: true,
    store: MongoStore.create({ mongoUrl: mongoUri, ttl: 24 * 60 * 60 }),
    cookie: {
      secure: isProd,
      sameSite: isProd ? "none" : "lax",
      domain: isProd ? ".nimesrp.fr" : undefined,
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000
    }
  })
);

app.use(passport.initialize());
app.use(passport.session());

app.use("/api/shadow", shadowRoutes);
app.use("/api", apiLimiter);
app.use("/api/auth", authRoutes);
app.use("/api/staff", staffRoutes);
app.use("/api/logs/stats", logsStatsRoutes);
app.use("/api/logs", logsRoutes);
app.use("/api/tickets", ticketsRoutes);
app.use("/api/server", serverRoutes);
app.use("/api/notifications", notificationRoutes);

app.get("/health", (req, res) => res.status(200).send("OK"));
app.use(errorHandler);

const server = http.createServer(app);
export const io = new Server(server, {
  cors: { origin: allowedOrigins, methods: ["GET", "POST"], credentials: true }
});

// --- CRON JOB ---
const LOG_CHANNEL_ID = process.env.LOG_CHANNEL_ID;
const SUPER_ADMIN_CHANNEL_ID = process.env.SUPER_ADMIN_CHANNEL_ID;

cron.schedule("*/15 * * * *", async () => {
  if (!discordClient?.isReady()) return;

  const limitDate = new Date(Date.now() - 3 * 60 * 60 * 1000);
  const safeDate = new Date(Date.now() - 24 * 60 * 60 * 1000);

  try {
    const oldLogs = await Log.find({
      type: { $in: ["ban", "kick"] },
      category: { $ne: "JUSTIFIÉ" },
      adminNotified: { $ne: true },
      createdAt: { $lt: limitDate, $gt: safeDate }
    });

    for (const log of oldLogs) {
      log.adminNotified = true;
      await log.save();
      
      const staff = await StaffUser.findOne({ robloxUsername: new RegExp(`^${log.author}$`, "i") });
      const isMod = staff?.role?.toUpperCase() === "MODERATEUR";
      const targetChannelId = isMod ? LOG_CHANNEL_ID : SUPER_ADMIN_CHANNEL_ID;
      
      const channel = await discordClient.channels.fetch(targetChannelId);
      if (channel) {
          await channel.send(`🚨 **RELIQUAT**\n${isMod ? 'Modérateur' : 'Admin'} **${log.author}** n'a pas justifié son action contre **${log.target}**.`);
      }
    }
  } catch (err) {
    logger.error("Erreur Cron:", err);
  }
});

const PORT = process.env.PORT || 8080;

async function startServer() {
  try {
    mongoose.set("strictQuery", false);
    await mongoose.connect(mongoUri);
    logger.info("✅ MongoDB Atlas : Connecté");

    server.listen(PORT, "0.0.0.0", () => {
      logger.info(`🚀 Serveur actif sur le port ${PORT}`);
    });

    // Lancement du Bot
    if (process.env.DISCORD_BOT_TOKEN) {
      initBot(io);
      logger.info("✅ Discord Bot : Initialisation lancée");
    }
  } catch (err) {
    logger.error(`❌ ERREUR DÉMARRAGE : ${err.message}`);
    process.exit(1);
  }
}

startServer();