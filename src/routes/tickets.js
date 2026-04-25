import express from "express";
import Joi from "joi";
import Ticket from "../models/Ticket.js";
import Notification from "../models/Notification.js";
import StaffUser from "../models/StaffUser.js";
import { io } from "../server.js"; 
import { auth } from "../middleware/auth.js";
import { requirePermission } from "../middleware/requirePermission.js";
import { logger } from "../utils/logger.js";
import { notifyNewTicket } from "../discordBot.js";

const router = express.Router();

// --- FONCTION UTILITAIRE DE NOTIFICATION ---
const sendStaffNotification = async (ticket) => {
  try {
    const staffMembers = await StaffUser.find({ 
      role: { $in: ["admin", "superadmin", "moderator"] } 
    });

    const notifData = {
      title: "🎫 Nouveau Ticket",
      message: `${ticket.playerName} a ouvert un ticket : ${ticket.subject}`,
      type: "alert",
      priority: "medium"
    };

    for (const staff of staffMembers) {
      const notif = await Notification.create({ 
        ...notifData, 
        userId: staff._id 
      });
      io.to(staff._id.toString()).emit("new_notification", notif);
    }
  } catch (err) {
    logger.error("Erreur lors de l'envoi des notifications staff:", err);
  }
};

// --- ROUTES PUBLIQUES (JOUEURS) ---

// Route pour soumettre un ticket
router.post("/submit", async (req, res) => {
  try {
    const { playerName, playerId, subject, message } = req.body;

    if (!playerName || !subject || !message) {
      return res.status(400).json({ error: "Champs manquants" });
    }

    const ticket = await Ticket.create({
      playerName,
      playerId: playerId || "unknown",
      subject,
      status: "open",
      lastReplyBy: "player", // ✅ Initialisé ici
      lastReplyAt: new Date(), // ✅ Initialisé ici
      messages: [{
        authorType: "player",
        authorName: playerName,
        content: message
      }]
    });

    notifyNewTicket(ticket);
    await sendStaffNotification(ticket);

    logger.info(`Nouveau ticket créé par ${playerName}: ${subject}`);
    res.status(201).json({ success: true, ticket });
  } catch (err) {
    logger.error("Erreur création ticket:", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// Récupérer un ticket spécifique par son ID (Public)
router.get("/:id", async (req, res) => {
  try {
    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) return res.status(404).json({ error: "Ticket introuvable" });
    res.json(ticket);
  } catch (err) {
    logger.error("Erreur récup ticket public:", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// Répondre à son propre ticket (Joueur)
router.post("/:id/message", async (req, res) => {
  try {
    const { sender, text } = req.body; 
    if (!text) return res.status(400).json({ error: "Message vide" });

    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) return res.status(404).json({ error: "Ticket introuvable" });
    if (ticket.status === "closed") return res.status(400).json({ error: "Ticket fermé" });

    ticket.messages.push({
      authorType: "player",
      authorName: sender || ticket.playerName,
      content: text
    });

    // ✅ MISE À JOUR DES DERNIÈRES INFOS
    ticket.lastReplyAt = new Date();
    ticket.lastReplyBy = "player";

    await ticket.save();
    res.json(ticket);
  } catch (err) {
    logger.error("Erreur réponse joueur:", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// --- ROUTES STAFF (PROTEGÉES) ---

// Récupérer la liste des tickets
router.get("/", auth, requirePermission("manage_tickets"), async (req, res) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const query = {};
    if (req.query.status) query.status = req.query.status;
    if (req.query.assigned) query.assignedTo = req.query.assigned;

    const [items, total] = await Promise.all([
      Ticket.find(query)
        .sort({ lastReplyAt: -1 }) // ✅ Tri par activité la plus récente
        .skip(skip)
        .limit(limit)
        .lean(),
      Ticket.countDocuments(query)
    ]);

    res.json({
      page,
      total,
      pages: Math.ceil(total / limit),
      items
    });
  } catch (err) {
    logger.error("Erreur récupération tickets:", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// Créer un ticket manuellement par le staff
router.post("/create", auth, requirePermission("manage_tickets"), async (req, res) => {
  try {
    const createTicketSchema = Joi.object({
      playerName: Joi.string().required(),
      playerId: Joi.string().allow(null, ''),
      subject: Joi.string().required(),
      message: Joi.string().required()
    });

    const { error } = createTicketSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    const { playerName, playerId, subject, message } = req.body;

    const ticket = await Ticket.create({
      playerName,
      playerId,
      subject,
      lastReplyBy: "staff", // ✅
      lastReplyAt: new Date(), // ✅
      messages: [{
        authorType: "staff",
        authorName: req.user?.username || "Staff",
        content: message
      }]
    });

    notifyNewTicket(ticket);
    await sendStaffNotification(ticket);

    res.json(ticket);
  } catch (err) {
    logger.error("Erreur staff create ticket:", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// Répondre à un ticket (Staff)
router.post("/:id/reply", auth, async (req, res) => {
  try {
    const replySchema = Joi.object({
      content: Joi.string().required()
    });

    const { error: replyError } = replySchema.validate(req.body);
    if (replyError) return res.status(400).json({ error: replyError.details[0].message });

    const { content } = req.body;
    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) return res.status(404).json({ error: "Ticket non trouvé" });

    ticket.messages.push({
      authorType: "staff",
      authorName: req.user?.username || "Staff",
      content
    });

    // ✅ MISE À JOUR DES INFOS ACTIVITÉ
    ticket.lastReplyAt = new Date();
    ticket.lastReplyBy = "staff";
    
    // Auto-assignation si personne n'est sur le ticket
    if (!ticket.assignedTo) ticket.assignedTo = req.user.id;

    await ticket.save();
    res.json(ticket);
  } catch (err) {
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// Changer le statut
router.post("/:id/status", auth, async (req, res) => {
  try {
    const statusSchema = Joi.object({
      status: Joi.string().valid("open", "in_progress", "closed").required()
    });

    const { error } = statusSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    const { status } = req.body;
    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) return res.status(404).json({ error: "Ticket non trouvé" });

    ticket.status = status;
    await ticket.save();
    res.json(ticket);
  } catch (err) {
    res.status(500).json({ error: "Erreur serveur" });
  }
});

export default router;
