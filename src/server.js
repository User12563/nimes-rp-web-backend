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
import Absence from "./models/Absence.js";

// --- DISCORD IMPORT ---
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
import absencesRoutes from "./routes/absences.js";
import notesRoutes from './routes/note.js';

// --- INITIALISATION APP ---
const app = express();

// 1. CONFIGURATION RÉSEAU & SÉCURITÉ
app.set('trust proxy', 1); 

const mongoUri = (process.env.MONGO_URI || "").trim();
if (!mongoUri) {
    logger.error("MONGO_URI non défini.");
    process.exit(1);
}

const allowedOrigins = [
    process.env.FRONTEND_URL || "http://localhost:5173",
    "https://www.nimesrp.fr",
    "https://nimesrp.fr"
];

app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));

app.use(cors({
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
        return callback(new Error("CORS policy: origine non autorisée"));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"]
}));

app.use(express.json());
app.use(morgan("dev"));

const isProd = process.env.NODE_ENV === "production";

// 2. SESSION & PASSPORT
app.use(session({
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
}));

app.use(passport.initialize());
app.use(passport.session());

// 3. ROUTES
app.use("/api/shadow", shadowRoutes);
app.use("/api", apiLimiter);
app.use("/api/auth", authRoutes);
app.use("/api/staff", staffRoutes);
app.use("/api/logs/stats", logsStatsRoutes);
app.use("/api/logs", logsRoutes);
app.use("/api/tickets", ticketsRoutes);
app.use("/api/server", serverRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/absences", absencesRoutes);
app.use('/api/notes', notesRoutes);
app.get("/health", (req, res) => res.status(200).send("OK"));

app.use(errorHandler);

// 4. SERVEUR HTTP & SOCKET.IO
const server = http.createServer(app);
export const io = new Server(server, {
    cors: { origin: allowedOrigins, methods: ["GET", "POST"], credentials: true }
});

// --- CRON 1 : VÉRIFICATION DES BANS NON JUSTIFIÉS (Toutes les 15 min) ---
cron.schedule("*/15 * * * *", async () => {
    if (!discordClient?.isReady()) return;

    const limitDate = new Date(Date.now() - 3 * 60 * 60 * 1000); 
    const safeDate = new Date(Date.now() - 24 * 60 * 60 * 1000); 

    try {
        const oldLogs = await Log.find({
            type: "ban", 
            category: { $ne: "JUSTIFIÉ" },
            adminNotified: { $ne: true },
            createdAt: { $lt: limitDate, $gt: safeDate }
        });

        const targetChannels = ["1495343566841446581", "1495343166205722685"];

        for (const log of oldLogs) {
            log.adminNotified = true;
            await log.save();
            
            const escapedAuthor = log.author.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const staff = await StaffUser.findOne({ 
                robloxUsername: { $regex: new RegExp(`^${escapedAuthor}$`, "i") } 
            });

            const staffMention = staff ? `<@${staff.discordId}>` : `**${log.author}** (Non lié)`;

            for (const channelId of targetChannels) {
                try {
                    const channel = await discordClient.channels.fetch(channelId);
                    if (channel) {
                        await channel.send({
                            content: `🚨 **RELIQUAT : BAN NON JUSTIFIÉ**\nLe staff ${staffMention} n'a pas justifié son bannissement sur **${log.target}**.`
                        });
                    }
                } catch (sendErr) {
                    logger.error(`Erreur envoi salon ${channelId}:`, sendErr.message);
                }
            }
        }
    } catch (err) {
        logger.error("Erreur Cron (Ban check):", err);
    }
});


// ==========================================
// 🛠️ CONFIGURATION DES IDS
// ==========================================
const SETTINGS = {
    GUILD_ID: "1380978534167613611",         // Ton ID serveur
    ABSENCE_ROLE_ID: "1498241578416734308"   // Ton ID rôle absent
};

// Cron Job : s'exécute toutes les 5 minutes
cron.schedule("*/5 * * * *", async () => {
    // On récupère le client Discord (assure-toi qu'il est accessible ici)
    if (!discordClient?.isReady()) return;

    try {
        const guild = discordClient.guilds.cache.get(SETTINGS.GUILD_ID);
        if (!guild) return;

        const now = new Date();
        const currentYear = now.getFullYear();
        
        // On récupère uniquement les absences qui sont encore en statut ACTIVE
        const absences = await Absence.find({ status: "ACTIVE" });

        for (const abs of absences) {
            // Helper pour transformer "JJ/MM HH:MM" en objet Date JS exploitable
            const parseDateTime = (str) => {
                if (!str) return new Date(0);
                const [datePart, timePart] = str.split(' ');
                const [day, month] = datePart.split('/').map(Number);
                const [hour, minute] = timePart ? timePart.split(':').map(Number) : [0, 0];
                return new Date(currentYear, month - 1, day, hour, minute);
            };

            const startDate = parseDateTime(abs.startDate);
            const endDate = parseDateTime(abs.endDate);
            const member = await guild.members.fetch(abs.discordId).catch(() => null);

            // Si le membre a quitté le serveur, on archive l'absence pour nettoyer
            if (!member) {
                abs.status = "ARCHIVED";
                await abs.save();
                continue;
            }

            const roleId = SETTINGS.ABSENCE_ROLE_ID;

            // 🟢 CAS 1 : L'absence est EN COURS (On est dans le créneau)
            if (now >= startDate && now <= endDate) {
                if (!member.roles.cache.has(roleId)) {
                    await member.roles.add(roleId).catch(() => {});
                    logger.info(`[AUTO-ABSENCE] Rôle ajouté à ${member.user.tag} (Début)`);
                }
            } 
            
            // 🔴 CAS 2 : L'absence est TERMINÉE (La date de fin est dépassée)
            else if (now > endDate) {
                // On retire le rôle
                if (member.roles.cache.has(roleId)) {
                    await member.roles.remove(roleId).catch(() => {});
                    logger.info(`[AUTO-ABSENCE] Rôle retiré à ${member.user.tag} (Fin automatique)`);
                }
                // On archive pour que le Cron ne le traite plus jamais
                abs.status = "ARCHIVED";
                await abs.save();
                logger.info(`[AUTO-ARCHIVE] Absence de ${abs.username} terminée et archivée.`);
            } 
            
            // ⚪ CAS 3 : L'absence est FUTURE (Pas encore commencée)
            else {
                // On s'assure qu'il n'a pas le rôle trop tôt
                if (member.roles.cache.has(roleId)) {
                    await member.roles.remove(roleId).catch(() => {});
                }
            }
        }
    } catch (err) {
        logger.error("Erreur dans le Cron Global Absences :", err);
    }
});

// 5. DÉMARRAGE
const PORT = process.env.PORT || 8080;

async function startServer() {
    try {
        mongoose.set("strictQuery", false);
        await mongoose.connect(mongoUri);
        logger.info("✅ MongoDB Atlas : Connecté");

        server.listen(PORT, "0.0.0.0", () => {
            logger.info(`🚀 Serveur actif sur le port ${PORT}`);
        });

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