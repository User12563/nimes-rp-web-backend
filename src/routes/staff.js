import express from "express";
import StaffUser from "../models/StaffUser.js";
import { auth } from "../middleware/auth.js";

const router = express.Router();

// --- GET : Liste complète du staff ---
router.get("/", auth, async (req, res) => {
  try {
    // On exclut l'accessKey par sécurité
    const staff = await StaffUser.find().select("-accessKey").sort({ createdAt: -1 });
    res.json(staff);
  } catch (err) {
    console.error("Erreur GET staff:", err);
    res.status(500).json({ error: "Impossible de récupérer la liste" });
  }
});

// --- POST : Création d'un nouvel agent ---
router.post("/create", auth, async (req, res) => {
  try {
    const { username, accessKey, role } = req.body;

    // SÉCURITÉ : Seul un admin ou superadmin peut créer du staff
    if (req.user.role === "mod") {
      return res.status(403).json({ error: "Permission insuffisante pour créer un agent" });
    }

    if (!username || !accessKey) {
      return res.status(400).json({ error: "Username et AccessKey requis" });
    }

    const existing = await StaffUser.findOne({ username });
    if (existing) return res.status(400).json({ error: "Ce nom d'agent est déjà utilisé" });

    // Normalisation du rôle en minuscules pour la cohérence
    const normalizedRole = role ? role.toLowerCase() : "mod";

    const newStaff = new StaffUser({ 
      username, 
      accessKey, 
      role: normalizedRole 
    });
    
    await newStaff.save();
    res.status(201).json({ message: "Agent enregistré avec succès" });
  } catch (err) {
    console.error("Erreur création staff:", err);
    res.status(500).json({ error: "Erreur serveur lors de la création" });
  }
});

// --- PUT : Mise à jour du rôle ---
// ✅ Correction pour s'assurer que l'ID est bien traité
router.put("/:id", auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    // 1. Validation rapide
    const validRoles = ["mod", "admin", "superadmin"];
    const normalizedRole = role?.toLowerCase();

    if (!validRoles.includes(normalizedRole)) {
      return res.status(400).json({ error: "Rôle invalide" });
    }

    // 2. Vérification de sécurité (Hiérarchie)
    const targetUser = await StaffUser.findById(id);
    if (!targetUser) return res.status(404).json({ error: "Utilisateur non trouvé" });

    if (targetUser.role === "superadmin" && req.user.role !== "superadmin") {
      return res.status(403).json({ error: "Seul un SuperAdmin peut modifier un autre SuperAdmin" });
    }

    // 3. LA CORRECTION : Utiliser findByIdAndUpdate au lieu de .save()
    // Cela évite de re-valider l'accessKey qui est absente ici
    const updatedUser = await StaffUser.findByIdAndUpdate(
      id,
      { $set: { role: normalizedRole } },
      { new: true, runValidators: true }
    ).select("-accessKey");

    res.json({ message: "Rôle mis à jour avec succès", user: updatedUser });
  } catch (error) {
    console.error("CRASH SERVEUR PUT STAFF:", error); // Regarde tes logs Railway pour voir l'erreur précise
    res.status(500).json({ error: "Erreur interne du serveur lors de la mise à jour" });
  }
});
// --- DELETE : Révocation d'un agent ---
router.delete("/:id", auth, async (req, res) => {
  try {
    const { id } = req.params;

    // SÉCURITÉ : Seul un admin ou superadmin peut supprimer
    if (req.user.role === "mod") {
      return res.status(403).json({ error: "Permission insuffisante" });
    }

    const staffToDelete = await StaffUser.findById(id);
    
    if (!staffToDelete) {
      return res.status(404).json({ error: "Agent introuvable" });
    }

    // Protection des SuperAdmins
    if (staffToDelete.role === "superadmin") {
      return res.status(403).json({ 
        error: "Action interdite", 
        message: "Les comptes SuperAdmin ne peuvent pas être révoqués ici." 
      });
    }

    // Empêcher de se supprimer soi-même
    if (req.user.id === id) {
      return res.status(400).json({ error: "Auto-suppression interdite" });
    }

    await StaffUser.findByIdAndDelete(id);
    res.json({ message: "Accès révoqué avec succès" });
  } catch (err) {
    console.error("Erreur DELETE staff:", err);
    res.status(500).json({ error: "Erreur lors de la suppression" });
  }
});

export default router;
