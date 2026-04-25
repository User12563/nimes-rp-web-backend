import mongoose from "mongoose";

const TicketSchema = new mongoose.Schema({
  playerName: { type: String, required: true },
  playerId: { type: String, default: "unknown" },
  subject: { type: String, required: true },
  status: { type: String, enum: ["open", "in_progress", "closed"], default: "open" },
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'StaffUser' },
  
  // --- AJOUT ICI ---
  lastReplyAt: { type: Date, default: Date.now },
  lastReplyBy: { type: String, enum: ["staff", "player"], default: "player" },
  // -----------------

  messages: [{
    authorType: { type: String, enum: ["staff", "player"], required: true },
    authorName: String,
    content: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
  }],
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model("Ticket", TicketSchema);
