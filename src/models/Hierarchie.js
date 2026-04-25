import mongoose from "mongoose";

const RoleSchema = new mongoose.Schema({
  name: { type: String, required: true },
  id: { type: String, required: true },
  description: { type: String, default: null }
});

const CategorySchema = new mongoose.Schema({
  name: { type: String, required: true },
  roles: { type: [RoleSchema], default: [] }
});

const HierarchieSchema = new mongoose.Schema(
  {
    guildId: { type: String, required: true },
    messageId: { type: String, required: true },
    categories: { type: [CategorySchema], default: [] }
  },
  { timestamps: true }
);

// On définit le modèle
const Hierarchie = mongoose.models.Hierarchie || mongoose.model("Hierarchie", HierarchieSchema);

// --- LES EXPORTS (Pour réconcilier tout ton projet) ---

// Permet : import { Hierarchie } from "..." (utilisé dans ta commande)
export { Hierarchie };

// Permet : import Hierarchy from "..." (utilisé dans interactionCreate.js)
export default Hierarchie;