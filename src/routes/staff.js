import express from "express";
import StaffUser from "../models/StaffUser.js";
import { auth } from "../middleware/auth.js";
import { requirePermission } from "../middleware/requirePermission.js"; // Import manquant ajouté
import { client as discordClient } from "../discord/index.js"; // On utilise l'alias discordClient
// ✅ NOUVELLE LIGNE (le bon chemin vers le dossier discord) :
import { warnAlert } from "../discord/utils/warnAlert.js";
const router = express.Router();

// Configuration des IDs de rôles Discord
const DISCORD_ROLES = {
    MODERATEUR: "1381159289179082752",
    ADMIN: "1381159291372830820",
    SUPER_ADMIN: ["1492493841696034867", "1381159290030522459"]
};

const GUILD_ID = process.env.DISCORD_GUILD_ID || "1380978534167613611";

// --- GET : Liste complète du staff ---
router.get("/", auth, async (req, res) => {
    try {
        const staff = await StaffUser.find().select("-accessKey").sort({ role: 1 });
        res.json(staff);
    } catch (err) {
        res.status(500).json({ error: "Impossible de récupérer la liste" });
    }
});

// --- POST : Ajouter un WARN ---
router.post("/:id/warn", auth, requirePermission("warn_staff"), async (req, res) => {
    try {
        const { reason } = req.body;
        const target = await StaffUser.findById(req.params.id);

        if (!target) return res.status(404).json({ error: "Staff introuvable" });
        if (target.role === "SUPER_ADMIN") return res.status(403).json({ error: "Action impossible" });

        const newWarn = {
            reason: reason || "Non spécifiée",
            by: req.user.username,
            date: new Date()
        };

        target.warns.push(newWarn);
        await target.save();

        // On appelle l'utilitaire (prévient la cible + les SuperAdmins si besoin)
        await checkAndNotifyWarn(discordClient, target, newWarn);

        res.json({ message: "Warn ajouté et staff notifié", totalWarns: target.warns.length });
    } catch (err) {
        res.status(500).json({ error: "Erreur lors de l'ajout du warn" });
    }
});

// --- DELETE : Révocation totale (DB + Discord) ---
router.delete("/:id", auth, requirePermission("manage_staff"), async (req, res) => {
    try {
        const { id } = req.params;

        const staffToDelete = await StaffUser.findById(id);
        if (!staffToDelete) return res.status(404).json({ error: "Agent introuvable" });

        // SÉCURITÉ : Protection des SUPER_ADMIN
        if (staffToDelete.role === "SUPER_ADMIN") {
            return res.status(403).json({ error: "Action interdite sur un SuperAdmin" });
        }

        // --- ACTION DISCORD ---
        if (discordClient?.isReady()) {
            try {
                const guild = await discordClient.guilds.fetch(GUILD_ID);
                const member = await guild.members.fetch(staffToDelete.discordId).catch(() => null);

                if (member) {
                    // 1. Envoi du message d'adieu (Avant de retirer les rôles)
                    const dmEmbed = {
                        color: 0xffa500, // Orange/Alerte
                        title: "❌ Révocation de vos accès Staff",
                        description: `Bonjour **${staffToDelete.username}**,\n\nNous vous informons que vos accès au staff de **Nîmes-RP** ont été révoqués par la haute administration.`,
                        fields: [
                            { name: "Serveur", value: "Nîmes-RP", inline: true },
                            { name: "Action", value: "Retrait immédiat des permissions", inline: true }
                        ],
                        footer: { text: "Ceci est un message automatique, inutile d'y répondre." },
                        timestamp: new Date()
                    };

                    try {
                        await member.send({ embeds: [dmEmbed] });
                    } catch (dmErr) {
                        console.log(`Impossible d'envoyer le DM à ${staffToDelete.username} (DMs fermés)`);
                    }

                    // 2. Retrait des rôles
                    const rolesToRemove = [
                        DISCORD_ROLES.MODERATEUR,
                        DISCORD_ROLES.ADMIN
                    ];
                    
                    await member.roles.remove(rolesToRemove, `Révoqué via Panel par ${req.user.username}`);
                }
            } catch (botErr) {
                console.error("Erreur Bot Discord pendant la révocation:", botErr.message);
            }
        }

        // 3. Suppression finale en Base de données
        await StaffUser.findByIdAndDelete(id);
        res.json({ message: "Agent révoqué, rôles retirés et membre notifié." });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Erreur lors de la suppression." });
    }
});

export default router;