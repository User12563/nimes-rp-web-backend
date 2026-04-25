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
const mongoUri = (process.env.MONGO_URI || process.env.MANGO || "").trim();

if (!mongoUri) {
  logger.error("MONGO_URI non défini. Vérifie tes variables d'environnement.");
  process.exit(1);
}

// ✅ CORS : autorisations frontales (ajoute d'autres origines si besoin)
const allowedOrigins = [
  process.env.FRONTEND_URL || "http://localhost:5173",
  "https://www.nimesrp.fr",
  "https://nimesrp.fr"
];

app.set("trust proxy", 1);

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" }
  })
);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error("CORS policy: origine non autorisée"));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"]
  })
);

app.use(express.json());
app.use(morgan("dev"));

// --- CONFIGURATION SESSION ---
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

// --- ROUTES API ---
// Shadow en priorité (tests)
app.use("/api/shadow", shadowRoutes);

// Appliquer rate limiter sur /api
app.use("/api", apiLimiter);

app.use("/api/auth", authRoutes);
app.use("/api/staff", staffRoutes);
app.use("/api/logs/stats", logsStatsRoutes);
app.use("/api/logs", logsRoutes);
app.use("/api/tickets", ticketsRoutes);
app.use("/api/server", serverRoutes);
app.use("/api/notifications", notificationRoutes);

app.get("/health", (req, res) => res.status(200).send("OK"));

// Gestion d'erreurs (doit être en dernier)
app.use(errorHandler);

const server = http.createServer(app);

export const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true
  }
});

io.on("connection", (socket) => {
  logger.info(`Socket.IO: nouvelle connexion (${socket.id})`);
  socket.on("disconnect", () => {
    logger.info(`Socket.IO: déconnexion (${socket.id})`);
  });
});

// --- CRON JOB (Justifications en retard) ---
const LOG_CHANNEL_ID = process.env.LOG_CHANNEL_ID || "1495343166205722685";
const SUPER_ADMIN_CHANNEL_ID = process.env.SUPER_ADMIN_CHANNEL_ID || "1495343566841446581";

cron.schedule("*/15 * * * *", async () => {
  logger.info("🔍 [Cron] Vérification des justifications en retard...");
  const limitDate = new Date(Date.now() - 3 * 60 * 60 * 1000);
  const safeDate = new Date(Date.now() - 24 * 60 * 60 * 1000);

  try {
    const discordModule = await import("./src/discord/index.js");
    const discordClient = discordModule.client;

    if (!discordClient || typeof discordClient.isReady !== "function" || !discordClient.isReady()) {
      logger.warn("Discord client non prêt, cron interrompu.");
      return;
    }

    const oldLogs = await Log.find({
      type: { $in: ["ban", "kick"] },
      category: { $ne: "JUSTIFIÉ" },
      adminNotified: { $ne: true },
      createdAt: { $lt: limitDate, $gt: safeDate }
    });

    for (const log of oldLogs) {
      log.adminNotified = true;
      await log.save();

      const staff = await StaffUser.findOne({
        robloxUsername: { $regex: new RegExp(`^${log.author}$`, "i") }
      });

      const isMod = staff?.role?.toUpperCase() === "MODERATEUR";
      const targetChannelId = isMod ? LOG_CHANNEL_ID : SUPER_ADMIN_CHANNEL_ID;
      const emoji = isMod ? "🚨" : "👑";
      const roleLabel = isMod ? "Modérateur" : "Admin";

      const message = `${emoji} **RELIQUAT DE JUSTIFICATION**\nLe ${roleLabel} **${log.author}** n'a pas justifié son action contre **${log.target}**.`;

      try {
        const channel = await discordClient.channels.fetch(targetChannelId);
        if (channel) await channel.send(message);
      } catch (err) {
        logger.error("Erreur Discord Cron:", err);
      }
    }
  } catch (err) {
    logger.error("Erreur Cron:", err);
  }
});

// --- DÉMARRAGE DU SERVEUR ---
const PORT = process.env.PORT || 8080;

async function startServer() {
  try {
    mongoose.set("strictQuery", false);
    await mongoose.connect(mongoUri);
    logger.info("✅ MongoDB Atlas : Connecté");

    // Anti-spam notifications au démarrage
    const cleanResult = await Log.updateMany(
      { adminNotified: { $ne: true } },
      { $set: { adminNotified: true } }
    );
    logger.info(`[Anti-Spam] Nettoyage terminé : ${cleanResult.modifiedCount} logs marqués.`);

    server.listen(PORT, "0.0.0.0", () => {
      logger.info(`🚀 Serveur actif sur le port ${PORT}`);
    });

    if (process.env.DISCORD_BOT_TOKEN) {
      try {
        const discordModule = await import("./src/discord/index.js");
        const initBot = discordModule.initBot || discordModule.default?.initBot;

        if (typeof initBot === "function") {
          initBot(io);
          logger.info("✅ initBot appelé avec succès (src/discord/index.js)");
        } else {
          logger.warn("initBot introuvable dans ./src/discord/index.js — vérifie les exports");
        }
      } catch (err) {
        logger.error("Erreur lors de l'import du module Discord :", err);
      }
    }
  } catch (err) {
    logger.error(`❌ ERREUR DÉMARRAGE : ${err.message}`);
    process.exit(1);
  }
}

startServer();

// --- ARRÊT PROPRE ---
process.on("SIGINT", async () => {
  logger.info("SIGINT reçu — arrêt du serveur...");
  try {
    await mongoose.disconnect();
    io.close();
    server.close(() => {
      logger.info("Serveur arrêté proprement.");
      process.exit(0);
    });
  } catch (err) {
    logger.error("Erreur lors de l'arrêt :", err);
    process.exit(1);
  }
});
