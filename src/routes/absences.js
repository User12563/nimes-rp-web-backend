import express from "express";
import Absence from "../models/Absence.js";
import Notification from "../models/Notification.js";
import StaffUser from "../models/StaffUser.js";
import { client as discordClient } from "../discord/index.js";
import { EmbedBuilder } from "discord.js";
import { logger } from "../utils/logger.js";
// ✅ Import supprimé car le fichier n'existe pas

const router = express.Router();

// ID du rôle Absence (on le prend dans le .env ou on met l'ID direct)
const ABSENCE_ROLE_ID = process.env.ABSENCE_ROLE_ID || "1498241578416734308";

// 🔒 Middleware pour vérifier l'authentification
const isAuthenticated = (req, res, next) => {
    if (req.isAuthenticated() && req.user) return next();
    res.status(401).json({ error: "Non autorisé. Veuillez vous connecter." });
};

// --- GET : Récupérer les absences actives ---
router.get("/", isAuthenticated, async (req, res) => {
    try {
        const absences = await Absence.find({ status: "ACTIVE" }).sort({ createdAt: -1 });
        res.json(absences);
    } catch (error) {
        logger.error(`Erreur GET /absences : ${error.message}`);
        res.status(500).json({ error: "Erreur lors de la récupération des absences." });
    }
});

// --- GET : Récupérer l'historique (Archives) ---
router.get("/archives", isAuthenticated, async (req, res) => {
    try {
        const archives = await Absence.find({ 
            discordId: req.user.discordId, 
            status: "ARCHIVED" 
        }).sort({ createdAt: -1 });
        res.json(archives);
    } catch (error) {
        res.status(500).json({ error: "Erreur lors de la récupération des archives." });
    }
});

// --- POST : Déclarer une nouvelle absence ---
router.post("/", isAuthenticated, async (req, res) => {
    const { type, startDate, endDate, reason } = req.body;

    if (!type || !startDate || !endDate || !reason) {
        return res.status(400).json({ error: "Tous les champs sont obligatoires." });
    }

    try {
        const count = await Absence.countDocuments({ 
            discordId: req.user.discordId, 
            status: "ACTIVE" 
        });

        if (count >= 3) {
            return res.status(400).json({ error: "Vous avez déjà trop d'absences actives." });
        }

        const newAbsence = await Absence.create({
            discordId: req.user.discordId,
            username: req.user.username,
            type,
            startDate,
            endDate,
            reason,
            status: "ACTIVE"
        });

        const admins = await StaffUser.find({ role: { $in: ["ADMIN", "SUPER_ADMIN"] } });
        const notifPromises = admins.map(admin => {
            return Notification.create({
                userId: admin._id,
                title: "📅 Nouvelle Absence",
                message: `${req.user.username} a déclaré une absence (${type}).`,
                type: "absence",
                priority: "medium",
                metadata: { actionBy: req.user.username, relatedId: newAbsence._id }
            });
        });
        await Promise.all(notifPromises);

        const LOG_CHANNEL_ID = process.env.ABSENCE_CHANNEL_ID || "1498217714919931915"; 
        if (discordClient?.isReady()) {
            const channel = discordClient.channels.cache.get(LOG_CHANNEL_ID);
            if (channel) {
                const embed = new EmbedBuilder()
                    .setTitle('🌐 NOUVELLE ABSENCE (Dashboard)')
                    .setColor('#3498DB')
                    .addFields(
                        { name: 'Staff', value: `<@${req.user.discordId}>`, inline: true },
                        { name: 'Type', value: `\`${type}\``, inline: true },
                        { name: 'Période', value: `Du **${startDate}** au **${endDate}**` },
                        { name: 'Raison', value: reason }
                    )
                    .setFooter({ text: 'Déclaré depuis le site web' })
                    .setTimestamp();

                await channel.send({ embeds: [embed] });
            }
        }

        res.status(201).json({ message: "Absence déclarée.", absence: newAbsence });

    } catch (error) {
        logger.error(`Erreur POST /absences : ${error.message}`);
        res.status(500).json({ error: "Erreur lors de l'enregistrement." });
    }
});

// --- DELETE : Supprimer (Archiver) une absence ---
router.delete("/:id", isAuthenticated, async (req, res) => {
    try {
        const absence = await Absence.findById(req.params.id);

        if (!absence) return res.status(404).json({ error: "Introuvable." });
        
        if (absence.discordId !== req.user.discordId && req.user.role !== "SUPER_ADMIN") {
            return res.status(403).json({ error: "Non autorisé." });
        }

        // ✅ Utilisation de la variable locale au lieu de CONFIG.ROLES
        const guild = discordClient.guilds.cache.get(process.env.GUILD_ID);
        const member = await guild?.members.fetch(absence.discordId).catch(() => null);
        if (member && member.roles.cache.has(ABSENCE_ROLE_ID)) {
            await member.roles.remove(ABSENCE_ROLE_ID).catch(() => {});
        }

        absence.status = "ARCHIVED";
        await absence.save();

        const LOG_CHANNEL_ID = process.env.ABSENCE_CHANNEL_ID || "1498217714919931915"; 
        if (discordClient?.isReady()) {
            const channel = discordClient.channels.cache.get(LOG_CHANNEL_ID);
            if (channel) {
                const embed = new EmbedBuilder()
                    .setTitle('🔙 RETOUR D\'ABSENCE (Dashboard)')
                    .setColor('#2ECC71')
                    .setDescription(`L'absence de <@${absence.discordId}> a été terminée/retirée par **${req.user.username}**.`)
                    .setTimestamp();
                await channel.send({ embeds: [embed] });
            }
        }

        res.json({ message: "Absence archivée et rôle actualisé." });
    } catch (error) {
        logger.error(`Erreur DELETE /absences : ${error.message}`);
        res.status(500).json({ error: "Erreur lors de la suppression." });
    }
});

export default router;