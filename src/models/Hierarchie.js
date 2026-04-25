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

export const Hierarchie = mongoose.model("Hierarchie", HierarchieSchema);
