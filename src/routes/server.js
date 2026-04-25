import express from "express";
import si from "systeminformation";
import { auth } from "../middleware/auth.js";

const router = express.Router();

router.get("/specs", auth, async (req, res) => {
  try {
    // On récupère les données statiques
    const [cpuInfo, mem, os, time, disks] = await Promise.all([
      si.cpu(),
      si.mem(),
      si.osInfo(),
      si.time(),
      si.fsSize()
    ]);

    // IMPORTANT : On demande la charge actuelle (Load) 
    // Cette fonction calcule la différence d'usage sur un court instant
    const load = await si.currentLoad();

    // On cherche le disque principal (souvent '/' ou 'C:')
    const mainDisk = disks.find(d => d.mount === '/' || d.mount === 'C:') || disks[0];

    res.json({
      cpu: {
        brand: cpuInfo.brand,
        cores: cpuInfo.cores,
        usage: Math.round(load.currentLoad) || 1, // On met 1 au lieu de 0 si c'est ultra faible
        speed: cpuInfo.speed + "GHz"
      },
      ram: {
        total: (mem.total / 1024 / 1024 / 1024).toFixed(2),
        used: (mem.active / 1024 / 1024 / 1024).toFixed(2),
        percent: Math.round((mem.active / mem.total) * 100)
      },
      os: {
        platform: os.platform,
        distro: os.distro,
        uptime: Math.floor(time.uptime / 3600) + "h " + Math.floor((time.uptime % 3600) / 60) + "m",
      },
      storage: {
        size: (mainDisk.size / 1024 / 1024 / 1024).toFixed(2),
        used: (mainDisk.used / 1024 / 1024 / 1024).toFixed(2),
        percent: Math.round(mainDisk.use)
      },
      nodeVersion: process.version
    });
  } catch (err) {
    console.error("Erreur hardware:", err);
    res.status(500).json({ error: "Erreur lecture système" });
  }
});

export default router;