import express from "express";
import si from "systeminformation";
import Log from "../models/Logs.js";
import Ticket from "../models/Ticket.js";
import StaffUser from "../models/StaffUser.js";
import Absence from "../models/Absence.js"; // ✅ Ajouté
import Notification from "../models/Notification.js"; // ✅ Ajouté
import { auth } from "../middleware/auth.js";

const router = express.Router();

/**
 * 1. DASHBOARD GLOBAL & KPI
 * Ajout des compteurs d'absences, notifications et warns
 */
router.get("/", auth, async (req, res) => {
  try {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [
      cpuLoad, 
      mem, 
      bans24h, 
      openTickets, 
      topStaffData, 
      totalLogs, 
      staffCount,
      activeAbsences, // ✅ Nouveau
      unreadNotifs,   // ✅ Nouveau
      totalTeamWarns  // ✅ Nouveau
    ] = await Promise.all([
      si.currentLoad(),
      si.mem(),
      Log.countDocuments({ action: "BAN", createdAt: { $gte: twentyFourHoursAgo } }),
      Ticket.countDocuments({ status: { $in: ["open", "in_progress"] } }),
      Log.aggregate([
        { $match: { createdAt: { $gte: twentyFourHoursAgo } } },
        { $group: { _id: "$author", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 1 },
        { $lookup: { from: "staffusers", localField: "_id", foreignField: "_id", as: "user" } }
      ]),
      Log.countDocuments(),
      StaffUser.countDocuments(),
      Absence.countDocuments({ status: "ACTIVE" }), // Compte les staffs absents
      Notification.countDocuments({ userId: req.user._id, read: false }), // Notifs du staff connecté
      StaffUser.aggregate([ { $project: { numberOfWarns: { $size: "$warns" } } }, { $group: { _id: null, total: { $sum: "$numberOfWarns" } } } ])
    ]);

    res.json({
      logs: totalLogs || 0,
      tickets: openTickets || 0,
      staff: staffCount || 0,
      bans24h: bans24h || 0,
      activeStaff: topStaffData[0]?.user[0]?.username || "Aucun",
      
      // ✅ Nouvelles données pour tes cartes KPI
      absences: activeAbsences || 0,
      notificationsCount: unreadNotifs || 0,
      totalWarns: totalTeamWarns[0]?.total || 0,

      // Stats Serveur
      serverLoad: Math.round(cpuLoad.currentLoad) + "%",
      cpuUsage: Math.round(cpuLoad.currentLoad),
      ramUsage: Math.round((mem.active / mem.total) * 100),
      memUsedGB: (mem.active / 1024 / 1024 / 1024).toFixed(2),
      uptime: Math.floor(si.time().uptime / 3600) + "h"
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur Dashboard" });
  }
});

/**
 * 2. STATS POUR LES GRAPHIQUES (PIE & AREA)
 */
router.get("/stats", auth, async (req, res) => {
  try {
    const [byType, byStaff] = await Promise.all([
      Log.aggregate([
        { $group: { _id: "$action", count: { $sum: 1 } } },
        { $project: { name: { $ifNull: ["$_id", "AUTRE"] }, value: "$count", _id: 0 } },
        { $sort: { value: -1 } }
      ]),
      Log.aggregate([
        { $group: { _id: "$author", count: { $sum: 1 } } },
        { $lookup: { from: "staffusers", localField: "_id", foreignField: "_id", as: "info" } },
        { $project: { name: { $arrayElemAt: ["$info.username", 0] }, count: 1 } },
        { $sort: { count: -1 } },
        { $limit: 5 }
      ])
    ]);
    res.json({ byType, byStaff });
  } catch (err) {
    res.status(500).json({ error: "Erreur stats" });
  }
});

/**
 * 3. ACTIVITÉ HORAIRE
 */
router.get("/hourly", auth, async (req, res) => {
  try {
    const stats = await Log.aggregate([
      { $group: { _id: { $hour: "$createdAt" }, total: { $sum: 1 } } },
      { $sort: { "_id": 1 } }
    ]);
    const fullDay = Array.from({ length: 24 }, (_, i) => ({
      hour: `${i}h`,
      total: stats.find(s => s._id === i)?.total || 0
    }));
    res.json(fullDay);
  } catch (err) {
    res.status(500).json({ error: "Erreur horaire" });
  }
});

/**
 * 4. STATS JOURNALIÈRES
 */
router.get("/daily", auth, async (req, res) => {
  try {
    const stats = await Log.aggregate([
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          total: { $sum: 1 }
        }
      },
      { $sort: { "_id": 1 } },
      { $limit: 14 }
    ]);
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: "Erreur daily" });
  }
});

export default router;