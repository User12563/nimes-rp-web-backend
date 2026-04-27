import express from 'express';
const router = express.Router();
import { isAuthenticated } from '../middleware/auth.js';
import StaffUser from '../models/StaffUser.js';
import Notification from '../models/Notification.js'; // ✅ Import du modèle
import { logger } from '../utils/logger.js';

/**
 * @route   GET /api/notes/:discordId
 * @desc    Récupérer la note d'un staff (Visible par toute l'équipe)
 */
router.get("/:discordId", isAuthenticated, async (req, res) => {
    try {
        const staff = await StaffUser.findOne({ discordId: req.params.discordId });
        
        if (!staff) {
            return res.status(404).json({ error: "Membre du staff introuvable." });
        }

        res.json({ 
            discordId: staff.discordId,
            username: staff.username,
            notes: staff.notes || "Aucune note enregistrée." 
        });
    } catch (error) {
        logger.error(`Erreur GET Note: ${error.message}`);
        res.status(500).json({ error: "Erreur lors de la récupération de la note." });
    }
});

/**
 * @route   PATCH /api/notes/:discordId
 * @desc    Modifier la note d'un staff (STRICTEMENT SUPER_ADMIN)
 */
router.patch("/:discordId", isAuthenticated, async (req, res) => {
    const { notes } = req.body;

    try {
        // 🔒 Sécurité : Seul le grade le plus haut peut éditer
        if (req.user.role !== "SUPER_ADMIN") {
            return res.status(403).json({ 
                error: "Accès refusé. Seul un Super Admin peut modifier les notes de suivi." 
            });
        }

        const cleanNotes = notes ? notes.trim() : "";

        // On cherche le staff
        const staff = await StaffUser.findOne({ discordId: req.params.discordId });

        if (!staff) {
            return res.status(404).json({ error: "Staff introuvable." });
        }

        // Mise à jour de la note
        staff.notes = cleanNotes;
        await staff.save();

        // ✅ CRÉATION DE LA NOTIFICATION pour le staff concerné
        await Notification.create({
            userId: staff._id, // Destinataire (le staff qui a été noté)
            title: "📝 Dossier de suivi mis à jour",
            message: `Une note a été ajoutée ou modifiée dans votre dossier par un Super Admin.`,
            type: "note",
            priority: "low",
            metadata: {
                actionBy: req.user.username // L'auteur de la modif
            }
        });

        logger.info(`[NOTES] Modification effectuée sur ${staff.username} par ${req.user.username}`);
        
        res.json({ 
            success: true, 
            message: "Note de suivi mise à jour et notification envoyée.", 
            notes: staff.notes 
        });
    } catch (error) {
        logger.error(`Erreur PATCH Note: ${error.message}`);
        res.status(500).json({ error: "Erreur lors de la mise à jour." });
    }
});

export default router;