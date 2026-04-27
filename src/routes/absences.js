import express from "express";
import Absence from "../models/Absence.js";
import { client as discordClient } from "../discord/index.js";
import { EmbedBuilder } from "discord.js";
import { logger } from "../utils/logger.js";

const router = express.Router();

// 🔒 Middleware pour vérifier que l'utilisateur est connecté via Discord
const isAuthenticated = (req, res, next) => {
    if (req.isAuthenticated() && req.user) return next();
    res.status(401).json({ error: "Non autorisé. Veuillez vous connecter." });
};

// --- GET : Récupérer les absences (Pour l'affichage sur le Dashboard) ---
router.get("/", isAuthenticated, async (req, res) => {
    try {
        // Si tu veux que les staffs ne voient que leurs propres absences :
        // const absences = await Absence.find({ discordId: req.user.discordId }).sort({ createdAt: -1 });
        
        // Si tu veux afficher toutes les absences (pour un calendrier global) :
        const absences = await Absence.find().sort({ createdAt: -1 });
        
        res.json(absences);
    } catch (error) {
        logger.error(`Erreur GET /absences : ${error.message}`);
        res.status(500).json({ error: "Erreur serveur lors de la récupération des absences." });
    }
});

// --- POST : Déclarer une nouvelle absence depuis le Dashboard ---
router.post("/", isAuthenticated, async (req, res) => {
    const { type, startDate, endDate, reason } = req.body;

    // 1. Vérification des champs requis
    if (!type || !startDate || !endDate || !reason) {
        return res.status(400).json({ error: "Tous les champs sont obligatoires." });
    }

    try {
        // 2. Enregistrement dans le même modèle Mongoose
        const newAbsence = await Absence.create({
            discordId: req.user.discordId,
            username: req.user.username,
            type,
            startDate,
            endDate,
            reason
        });

        // 3. Envoi du log sur Discord (Identique au bot)
        // ⚠️ N'oublie pas de remplacer l'ID ci-dessous par l'ID de ton salon d'absences
        const LOG_CHANNEL_ID = process.env.ABSENCE_CHANNEL_ID || "TON_ID_DE_SALON_ICI"; 
        
        if (discordClient?.isReady()) {
            const channel = discordClient.channels.cache.get(LOG_CHANNEL_ID);
            if (channel) {
                const embed = new EmbedBuilder()
                    .setTitle('🌐 NOUVELLE ABSENCE (Via Dashboard)')
                    .setColor('#3498DB') // Bleu pour différencier du bot si tu veux
                    .addFields(
                        { name: 'Staff', value: `<@${req.user.discordId}>`, inline: true },
                        { name: 'Type', value: `\`${type}\``, inline: true },
                        { name: 'Dates', value: `Du **${startDate}** au **${endDate}**` },
                        { name: 'Raison', value: reason }
                    )
                    .setFooter({ text: 'Déclaré depuis Nîmes-RP.fr' });

                await channel.send({ embeds: [embed] });
            }
        }

        // 4. Réponse au site web
        res.status(201).json({ 
            message: "Absence déclarée avec succès.", 
            absence: newAbsence 
        });

    } catch (error) {
        logger.error(`Erreur POST /absences : ${error.message}`);
        res.status(500).json({ error: "Erreur lors de l'enregistrement de l'absence." });
    }
});

export default router;