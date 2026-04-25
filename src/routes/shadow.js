import express from "express";
import axios from "axios";
import si from "systeminformation";
import dotenv from "dotenv";

// --- MIDDLEWARES ---
import { auth, requireRole } from "../middleware/auth.js";

// --- MODÈLES (Seulement ceux qui existent chez toi) ---
import Log from "../models/Logs.js";
import StaffUser from "../models/StaffUser.js";
import Ticket from "../models/Ticket.js";

dotenv.config();
const router = express.Router();

router.get("/profile/:identifier", auth, requireRole("SUPER_ADMIN"), async (req, res) => {
  const { identifier } = req.params;
  
  const response = {
    status: "DATA_INFILTRATION_COMPLETE",
    timestamp: new Date().toISOString(),
    subject: { type: "UNKNOWN", clearance: "NONE", internal_id: null },
    identity_matrix: { discord: "NO_DISCORD_LINK", roblox: "NO_ROBLOX_DATA" },
    live_status: { online: "OFFLINE", last_online: null, current_place: null, cpu_load: "0%" },
    social_footprint: { groups: [], primary_group: null },
    internal_records: { total_logs: 0, recent_actions: [], sanctions_count: 0, last_sanction: null },
    risk_assessment: { score: 0, level: "LOW", flags: [] }
  };

  try {
    // --- 1. IDENTIFICATION INTERNE (Discord/Staff) ---
    let internalStaffData = await StaffUser.findOne({
      $or: [
        { discordId: identifier },
        { username: new RegExp(`^${identifier}$`, "i") },
        { robloxUsername: new RegExp(`^${identifier}$`, "i") },
        { robloxId: identifier }
      ]
    }).lean();

    let robloxId = internalStaffData?.robloxId || null;

    // --- 2. RÉSOLUTION ROBLOX (Si non trouvé en base) ---
    if (!robloxId) {
      if (!isNaN(identifier) && identifier.length > 5) {
        robloxId = identifier;
      } else {
        try {
          const search = await axios.post("https://users.roblox.com/v1/usernames/users", {
            usernames: [identifier],
            excludeBannedUsers: false
          });
          robloxId = search.data.data[0]?.id || null;
        } catch (e) { console.warn("Roblox API Error"); }
      }
    }

    // --- 3. APPELS API & SYSTÈME ---
    const robloxPromises = robloxId ? [
      axios.get(`https://users.roblox.com/v1/users/${robloxId}`).then(r => r.data).catch(() => null),
      axios.post(`https://presence.roblox.com/v1/presence/users`, { userIds: [robloxId] }).then(r => r.data).catch(() => null),
      axios.get(`https://groups.roblox.com/v1/users/${robloxId}/groups/roles`).then(r => r.data).catch(() => null),
      axios.get(`https://premiumfeatures.roblox.com/v1/users/${robloxId}/validate-membership`).then(r => r.data).catch(() => false)
    ] : [null, null, null, false];

    const [robloxInfo, robloxPresence, robloxGroups, robloxPremium, sysLoad] = await Promise.all([
      ...robloxPromises,
      si.currentLoad().catch(() => ({ currentLoad: 5 }))
    ]);

    // --- 4. RÉCUPÉRATION DES LOGS (Sans Sanctions) ---
    let internalLogs = [];
    if (internalStaffData || robloxId) {
      const searchId = internalStaffData?._id || identifier;
      internalLogs = await Log.find({ 
        $or: [{ author: searchId }, { target: identifier }, { target: robloxId }] 
      }).sort({ createdAt: -1 }).limit(20).lean().catch(() => []);
    }

    // --- 5. MAPPING DES DONNÉES ---
    const ageDays = robloxInfo ? Math.floor((new Date() - new Date(robloxInfo.created)) / (1000 * 86400)) : 0;

    // Subject
    response.subject = {
      type: internalStaffData ? "INTERNAL_AGENT" : "EXTERNAL_ENTITY",
      clearance: internalStaffData?.role || "NONE",
      internal_id: internalStaffData?._id || null
    };

    // Identity
    if (internalStaffData) {
      response.identity_matrix.discord = {
        id: internalStaffData.discordId,
        tag: internalStaffData.username,
        avatar: internalStaffData.avatar,
        lastLogin: internalStaffData.lastLogin
      };
    }

    if (robloxInfo) {
      response.identity_matrix.roblox = {
        id: robloxId,
        username: robloxInfo.name,
        displayName: robloxInfo.displayName,
        age_days: ageDays,
        created: robloxInfo.created,
        isBanned: robloxInfo.isBanned,
        hasPremium: robloxPremium === true || robloxPremium?.isPremium === true
      };
    }

    // Live Status
    const pres = robloxPresence?.userPresences?.[0];
    response.live_status = {
      online: pres?.userPresenceType === 2 ? "IN_GAME" : (pres?.userPresenceType === 1 ? "ONLINE" : "OFFLINE"),
      last_online: pres?.lastOnline,
      current_place: pres?.lastLocation || pres?.placeId,
      cpu_load: `${Math.round(sysLoad.currentLoad)}%`
    };

    // Social
    response.social_footprint.groups = robloxGroups?.data?.map(g => ({
      name: g.group.name,
      role: g.role.name,
      memberCount: g.group.memberCount
    })) || [];

    // Records
    response.internal_records = {
      total_logs: internalLogs.length,
      recent_actions: internalLogs.map(l => ({ action: l.action, date: l.createdAt, target: l.target })),
      sanctions_count: 0, // Mis à 0 car tu n'as pas de modèle Sanction
      last_sanction: null
    };

    // Risk Assessment
    let score = 0;
    if (ageDays < 30) { score += 20; response.risk_assessment.flags.push("NEW_ACCOUNT"); }
    if (robloxInfo?.isBanned) { score += 50; response.risk_assessment.flags.push("ROBLOX_BANNED"); }
    if (!internalStaffData) { score += 15; response.risk_assessment.flags.push("EXTERNAL_USER"); }

    response.risk_assessment = {
      score: Math.min(100, score),
      level: score > 60 ? "CRITICAL" : (score > 30 ? "MEDIUM" : "LOW"),
      flags: response.risk_assessment.flags
    };

    res.json(response);

  } catch (err) {
    console.error("Shadow Error:", err);
    res.status(500).json({ error: "SYSTEM_FAILURE", details: err.message });
  }
});

export default router;
