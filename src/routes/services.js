import express from 'express';
const router = express.Router();
import { isAuthenticated } from '../middlewares/auth.js';
import StaffUser from '../models/StaffUser.js'; // Ton modèle Mongoose
import { CONFIG } from '../config.js';
import { logger } from '../utils/logger.js';

router.post("/duty", isAuthenticated, async (req, res) => {
    const { action } = req.body; // Attendu : "ON" ou "OFF"
    const discordId = req.user.discordId;

    try {
        // Récupération du client Discord (injecté dans app.js via app.set('discordClient', client))
        const discordClient = req.app.get('discordClient');
        const guild = discordClient?.guilds.cache.get(process.env.GUILD_ID);
        const member = await guild?.members.fetch(discordId).catch(() => null);

        // Recherche du staff dans ta collection StaffUser
        const staff = await StaffUser.findOne({ discordId });

        if (!staff) {
            return res.status(404).json({ error: "Compte staff non trouvé en base de données." });
        }

        // --- ACTION : PRISE DE SERVICE ---
        if (action === "ON") {
            if (staff.status === 'SERVICE') {
                return res.status(400).json({ error: "Vous êtes déjà enregistré en service." });
            }

            staff.status = 'SERVICE';
            staff.currentServiceStart = new Date(); // Utilise ton champ Schema
            await staff.save();

            // Synchro Discord
            if (member) {
                await member.roles.add(CONFIG.ROLES.SERVICE).catch(() => {});
                if (member.manageable) {
                    await member.setNickname(`[SERV] ${staff.username}`).catch(() => {});
                }
            }
            logger.info(`[SERVICE] ${staff.username} a pris son service via le Dashboard.`);
        } 
        
        // --- ACTION : FIN DE SERVICE ---
        else if (action === "OFF") {
            if (staff.status !== 'SERVICE') {
                return res.status(400).json({ error: "Vous n'êtes pas en service actuellement." });
            }

            // Calcul de la durée
            const now = new Date();
            const startTime = staff.currentServiceStart || now;
            const durationMs = now.getTime() - startTime.getTime();

            // Mise à jour des statistiques de ton Schema
            staff.totalServiceTime += durationMs;
            staff.weeklyServiceTime += durationMs;
            staff.status = 'ONLINE'; // Passe en ONLINE (ou OFFLINE selon ton choix)
            staff.currentServiceStart = null;
            staff.lastServiceEnd = now;
            
            await staff.save();

            // Synchro Discord
            if (member) {
                await member.roles.remove(CONFIG.ROLES.SERVICE).catch(() => {});
                if (member.manageable) {
                    const cleanNick = staff.username.replace("[SERV] ", "");
                    await member.setNickname(cleanNick).catch(() => {});
                }
            }
            logger.info(`[SERVICE] ${staff.username} a terminé son service via le Dashboard. Durée : ${Math.floor(durationMs / 60000)} min.`);
        }

        return res.json({ 
            success: true, 
            status: staff.status, 
            weeklyTime: staff.weeklyServiceTime 
        });

    } catch (error) {
        logger.error(`Erreur Route Duty: ${error.message}`);
        res.status(500).json({ error: "Une erreur est survenue lors du pointage." });
    }
});

export default router;