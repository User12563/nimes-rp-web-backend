import express from "express";
import Joi from "joi";
import { Parser } from "json2csv";
import ExcelJS from "exceljs";
import Log from "../models/Logs.js";
import Notification from "../models/Notification.js";
import StaffUser from "../models/StaffUser.js";
import { io } from "../server.js"; 
import { auth } from "../middleware/auth.js";
import { requirePermission } from "../middleware/requirePermission.js";

const router = express.Router();

// ==========================================
// GET LOGS (AVEC FILTRES + TRI + PAGINATION)
// ==========================================
router.get("/", auth, async (req, res) => {
  try {
    const logsQuerySchema = Joi.object({
      // ✅ "unban" est maintenant explicitement autorisé et validé
      type: Joi.string()
        .valid("ban", "kick", "unban", "vehicle", "shutdown", "mod_change", "other")
        .insensitive()
        .allow(""),

      staff: Joi.string().allow(""),
      target: Joi.string().allow(""),
      category: Joi.string().allow(""),
      q: Joi.string().allow(""),

      page: Joi.number().integer().min(1).default(1),
      limit: Joi.number().integer().min(1).max(200).default(50),
      sort: Joi.string().valid("asc", "desc").default("desc"),
    });

    const { error, value } = logsQuerySchema.validate(req.query);
    if (error) return res.status(400).json({ error: error.details[0].message });

    const { type, staff, target, category, q, page, limit, sort } = value;

    const query = {};

    if (type) query.type = type.toLowerCase();
    if (staff) query.author = { $regex: staff.trim(), $options: "i" };
    if (target) query.target = { $regex: target.trim(), $options: "i" };
    if (category) query.category = { $regex: category.trim(), $options: "i" };

    if (q) {
      const search = q.trim();
      query.$or = [
        { action: { $regex: search, $options: "i" } },
        { raw: { $regex: search, $options: "i" } }, // ✅ Permet de chercher par raison/justification
        { target: { $regex: search, $options: "i" } },
        { author: { $regex: search, $options: "i" } },
      ];
    }

    const skip = (page - 1) * limit;
    const sortOption = { createdAt: sort === "asc" ? 1 : -1 };

    const [items, total] = await Promise.all([
      Log.find(query)
        .sort(sortOption)
        .skip(skip)
        .limit(limit)
        .lean(),
      Log.countDocuments(query),
    ]);

    res.json({ page, limit, total, items });

  } catch (err) {
    console.error("Erreur Logs GET:", err);
    res.status(500).json({ error: "Erreur serveur lors de la récupération des logs" });
  }
});

// ========================================================
// POST LOG : CRÉATION + NOTIFICATION TEMPS RÉEL STAFF
// ========================================================
router.post("/", auth, async (req, res) => {
  try {
    const newLog = await Log.create(req.body);

    const logType = newLog.type?.toLowerCase() || "other";
    const criticalTypes = ["ban", "kick", "unban", "shutdown", "mod_change"];
    
    if (criticalTypes.includes(logType)) {
      const staffToNotify = await StaffUser.find({ 
        role: { $in: ["ADMIN", "SUPER_ADMIN"] } 
      }).select('_id');

      const notifData = {
        title: `🚨 Alerte : ${logType.toUpperCase()}`,
        message: `${newLog.author || 'Système'} a effectué : ${newLog.action || 'Action inconnue'}`,
        type: (logType === "ban" || logType === "unban") ? "alert" : "info",
        priority: logType === "ban" ? "high" : "medium"
      };

      const notifPromises = staffToNotify.map(async (staff) => {
        const notif = await Notification.create({ 
          ...notifData, 
          userId: staff._id 
        });

        if (io) {
          io.to(staff._id.toString()).emit("new_notification", notif);
        }
      });

      await Promise.all(notifPromises);
    }

    res.status(201).json(newLog);
  } catch (err) {
    console.error("Erreur POST Log:", err);
    res.status(500).json({ error: "Erreur création log & notification" });
  }
});

// =========================
// EXPORT CSV
// =========================
router.get("/export/csv", auth, requirePermission("export_logs"), async (req, res) => {
    try {
      const { type, staff, target, category, sort = "desc" } = req.query;
      const query = {};

      if (type) query.type = type.toLowerCase();
      if (staff) query.author = { $regex: staff.trim(), $options: "i" };
      if (target) query.target = { $regex: target.trim(), $options: "i" };
      if (category) query.category = { $regex: category.trim(), $options: "i" };

      const logs = await Log.find(query)
        .sort({ createdAt: sort === "asc" ? 1 : -1 })
        .lean();

      const fields = [
        { label: 'Date', value: (row) => new Date(row.createdAt).toLocaleString('fr-FR') },
        { label: 'Type', value: 'type' },
        { label: 'Staff', value: 'author' },
        { label: 'Joueur', value: 'target' },
        { label: 'Action', value: 'action' },
        { label: 'Justification / Détails', value: 'raw' } // ✅ Inclus dans l'export
      ];

      const parser = new Parser({ fields });
      const csv = parser.parse(logs);

      res.header("Content-Type", "text/csv");
      res.attachment(`logs_${new Date().toISOString().slice(0, 10)}.csv`);
      return res.send(csv);
    } catch (err) {
      res.status(500).json({ error: "Erreur export CSV" });
    }
  }
);

// =========================
// EXPORT EXCEL
// =========================
router.get("/export/excel", auth, requirePermission("export_logs"), async (req, res) => {
    try {
      const { type, staff, target, category, sort = "desc" } = req.query;
      const query = {};

      if (type) query.type = type.toLowerCase();
      if (staff) query.author = { $regex: staff.trim(), $options: "i" };
      if (target) query.target = { $regex: target.trim(), $options: "i" };
      if (category) query.category = { $regex: category.trim(), $options: "i" };

      const logs = await Log.find(query)
        .sort({ createdAt: sort === "asc" ? 1 : -1 })
        .lean();

      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet("Logs");

      sheet.columns = [
        { header: "Date", key: "date", width: 25 },
        { header: "Type", key: "type", width: 15 },
        { header: "Staff", key: "author", width: 25 },
        { header: "Joueur", key: "target", width: 25 },
        { header: "Action", key: "action", width: 35 },
        { header: "Justification / Détails", key: "raw", width: 55 }, // ✅ Colonne pour la raison
      ];

      sheet.getRow(1).font = { bold: true };

      logs.forEach((log) => {
        sheet.addRow({
          date: new Date(log.createdAt).toLocaleString('fr-FR'),
          type: log.type?.toUpperCase() || "OTHER",
          author: log.author || "Système",
          target: log.target || "N/A",
          action: log.action || "N/A",
          raw: log.raw || ""
        });
      });

      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename=logs_${new Date().toISOString().slice(0, 10)}.xlsx`);

      await workbook.xlsx.write(res);
      res.end();
    } catch (err) {
      res.status(500).json({ error: "Erreur export Excel" });
    }
  }
);

// =========================
// DELETE LOG (SÉCURISÉ)
// =========================
router.delete("/:id", auth, requirePermission("manage_logs"), async (req, res) => {
    try {
      if (req.user.role?.toUpperCase() !== "SUPER_ADMIN") {
        return res.status(403).json({ error: "Permissions insuffisantes (Super Admin requis)." });
      }

      const deleted = await Log.findByIdAndDelete(req.params.id);
      if (!deleted) return res.status(404).json({ error: "Log introuvable" });

      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Erreur lors de la suppression" });
    }
  }
);

// ==========================================
// ✅ JUSTIFIER UN LOG (BAN/KICK)
// ==========================================
router.put("/:id/justify", auth, async (req, res) => {
  try {
    const { reason } = req.body;
    const logId = req.params.id;

    if (!reason || reason.trim().length < 5) {
      return res.status(400).json({ error: "Une justification plus détaillée est requise (min 5 caractères)." });
    }

    const log = await Log.findById(logId);
    if (!log) return res.status(404).json({ error: "Log introuvable." });

    // Vérification : Seul l'auteur peut justifier
    if (log.author.toLowerCase() !== req.user.robloxUsername.toLowerCase()) {
      return res.status(403).json({ error: "Vous ne pouvez pas justifier une action que vous n'avez pas commise." });
    }

    // ✅ MODIFICATION : On met à jour 'action' ET 'raw' (pour affichage détails)
    log.action = `[JUSTIFIÉ] ${reason}`;
    log.category = "JUSTIFIÉ";
    
    // On conserve l'ancienne donnée 'raw' s'il y en avait, et on ajoute la raison au début
    log.raw = `RAISON : ${reason} | (Détails d'origine : ${log.raw || 'Aucun'})`;
    
    log.adminNotified = true; // Empêche le robot Discord de spammer pour ce log
    await log.save();

    if (io) {
      io.emit("log_updated", { 
        id: logId, 
        action: log.action, 
        category: log.category,
        raw: log.raw 
      });
    }

    res.json({ success: true, message: "Justification enregistrée avec succès." });
  } catch (err) {
    console.error("Erreur justification log:", err);
    res.status(500).json({ error: "Erreur lors de l'enregistrement." });
  }
});

export default router;
