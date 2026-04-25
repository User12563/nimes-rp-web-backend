import mongoose from "mongoose";

const logSchema = new mongoose.Schema({
  type: String,             // ex: "MODERATION", "ECONOMY"
  target: String,           // Le joueur visé (Pseudo ou ID)
  author: String,           // Le staff qui a fait l'action
  action: String,           // ex: "BAN", "GIVE_MONEY"
  category: String,         // ex: "VEHICLE", "PLAYER"
  raw: String,              // Le message complet brut
  discordMessageId: { type: String, unique: true, sparse: true }, // sparse: true si certains logs n'ont pas d'ID Discord
  createdAt: { type: Date, default: Date.now }
});

// --- INDEXATION ---

// 1. Index de recherche globale (UN SEUL permis)
logSchema.index({
  target: "text",
  author: "text",
  action: "text",
  raw: "text"
});

// 2. Index simples pour les filtres rapides
logSchema.index({ type: 1 });
logSchema.index({ author: 1 });
logSchema.index({ createdAt: -1 });

// 3. Index combiné pour les performances du Panel Staff
logSchema.index({ type: 1, author: 1, createdAt: -1 });

export default mongoose.model("Log", logSchema);