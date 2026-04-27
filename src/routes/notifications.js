import express from "express";
import Notification from "../models/Notification.js";
import { isAuthenticated } from "../middleware/auth.js"; 

const router = express.Router();

// --- RÉCUPÉRER LES NOTIFICATIONS ---
router.get("/", isAuthenticated, async (req, res) => {
  try {
    // Note : On utilise req.user._id (l'ID MongoDB) et non le discordId
    // car ton schéma Notification utilise un type ObjectId
    const notifications = await Notification.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .limit(50);
      
    res.json(notifications);
  } catch (err) {
    res.status(500).json({ error: "Erreur lors de la récupération" });
  }
});

// --- MARQUER COMME LUE ---
router.patch("/:id/read", isAuthenticated, async (req, res) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { read: true },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({ error: "Notification introuvable ou non autorisée" });
    }

    res.json({ success: true, notification });
  } catch (err) {
    res.status(500).json({ error: "Erreur lors de la mise à jour" });
  }
});

// --- MARQUER TOUT COMME LU (Optionnel mais recommandé) ---
router.post("/read-all", isAuthenticated, async (req, res) => {
  try {
    await Notification.updateMany(
      { userId: req.user._id, read: false },
      { read: true }
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Erreur lors de la mise à jour globale" });
  }
});

// --- SUPPRIMER UNE NOTIFICATION ---
router.delete("/:id", isAuthenticated, async (req, res) => {
  try {
    const result = await Notification.findOneAndDelete({ 
      _id: req.params.id, 
      userId: req.user._id 
    });

    if (!result) {
      return res.status(404).json({ error: "Notification introuvable" });
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Erreur lors de la suppression" });
  }
});

export default router;