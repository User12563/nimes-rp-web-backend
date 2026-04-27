import express from "express";
import StaffUser from "../models/StaffUser.js";
import Notification from "../models/Notification.js"; // ✅ Import ajouté
import { auth } from "../middleware/auth.js";
import { requirePermission } from "../middleware/requirePermission.js";
import { client as discordClient } from "../discord/index.js";
import { checkAndNotifyWarn } from "../discord/utils/warnAlert.js";

const router = express.Router();

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

        // ✅ 1. Notification Dashboard pour la cible
        await Notification.create({
            userId: target._id,
            title: "⚠️ Avertissement Reçu",
            message: `Vous avez reçu un warn pour : ${newWarn.reason}.`,
            type: "warn",
            priority: "high",
            metadata: { actionBy: req.user.username }
        });

        // 2. Notification Discord (Cible + Logs)
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
        if (staffToDelete.role === "SUPER_ADMIN") {
            return res.status(403).json({ error: "Action interdite sur un SuperAdmin" });
        }

        // --- ACTION DISCORD ---
        if (discordClient?.isReady()) {
            try {
                const guild = await discordClient.guilds.fetch(GUILD_ID);
                const member = await guild.members.fetch(staffToDelete.discordId).catch(() => null);

                if (member) {
                    // DM d'adieu
                    const dmEmbed = {
                        color: 0xffa500,
                        title: "❌ Révocation de vos accès Staff",
                        description: `Bonjour **${staffToDelete.username}**,\n\nVos accès au staff ont été révoqués par la haute administration.`,
                        timestamp: new Date()
                    };
                    await member.send({ embeds: [dmEmbed] }).catch(() => {});

                    // Retrait rôles
                    const rolesToRemove = [DISCORD_ROLES.MODERATEUR, DISCORD_ROLES.ADMIN];
                    await member.roles.remove(rolesToRemove, `Révoqué via Panel par ${req.user.username}`);
                }
            } catch (botErr) {
                console.error("Erreur Bot Discord:", botErr.message);
            }
        }

        // ✅ 3. Notification pour tous les SUPER_ADMIN (Alerte Révocation)
        const superAdmins = await StaffUser.find({ role: "SUPER_ADMIN" });
        const notifPromises = superAdmins.map(admin => {
            return Notification.create({
                userId: admin._id,
                title: "🚫 Staff Révoqué",
                message: `L'agent ${staffToDelete.username} a été révoqué par ${req.user.username}.`,
                type: "alert",
                priority: "high"
            });
        });
        await Promise.all(notifPromises);

        // 4. Suppression DB
        await StaffUser.findByIdAndDelete(id);
        res.json({ message: "Agent révoqué, rôles retirés et membre notifié." });

    } catch (err) {
        res.status(500).json({ error: "Erreur lors de la suppression." });
    }
});

export default router;