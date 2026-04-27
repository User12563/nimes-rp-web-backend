import express from 'express';
const router = express.Router();
import { isAuthenticated } from '../middleware/auth.js'; // Vérifie bien s'il y a un 's' à middleware
import StaffUser from '../models/StaffUser.js';
import { logger } from '../utils/logger.js';

// ==========================================
// 🛠️ CONFIGURATION DES IDS (À REMPLIR)
// ==========================================
const SERVICE_ROLE_ID = "1498250482802495600"; // 👈 Mets l'ID du rôle "En Service" ici
const GUILD_ID = "1380978534167613611";          // 👈 Mets l'ID de ton serveur Discord ici

router.post("/duty", isAuthenticated, async (req, res) => {
    const { action } = req.body; 
    const discordId = req.user.discordId;

    try {
        const discordClient = req.app.get('discordClient');
        
        // Utilisation de l'ID en dur pour la Guild
        const guild = discordClient?.guilds.cache.get(GUILD_ID);
        const member = await guild?.members.fetch(discordId).catch(() => null);

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
            staff.currentServiceStart = new Date();
            await staff.save();

            // ✅ Synchro Discord : AJOUT DU RÔLE
            if (member) {
                // On utilise l'ID en dur ici
                await member.roles.add(SERVICE_ROLE_ID).catch((err) => {
                    logger.error(`Erreur ajout rôle service: ${err.message}`);
                });

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

            const now = new Date();
            const startTime = staff.currentServiceStart || now;
            const durationMs = now.getTime() - startTime.getTime();

            staff.totalServiceTime += durationMs;
            staff.weeklyServiceTime += durationMs;
            staff.status = 'ONLINE'; 
            staff.currentServiceStart = null;
            staff.lastServiceEnd = now;
            
            await staff.save();

            // ✅ Synchro Discord : RETRAIT DU RÔLE
            if (member) {
                // On utilise l'ID en dur ici
                await member.roles.remove(SERVICE_ROLE_ID).catch((err) => {
                    logger.error(`Erreur retrait rôle service: ${err.message}`);
                });

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