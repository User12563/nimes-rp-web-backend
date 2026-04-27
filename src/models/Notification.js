import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema({
  // Le staff qui reçoit la notification
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'StaffUser', required: true },
  
  title: { type: String, required: true },
  message: { type: String, required: true },
  
  type: { 
    type: String, 
    enum: [
      'info', 
      'alert', 
      'ban_injustified', // ✅ Pour les bans suspects < 3h
      'absence',         // ✅ Pour les nouvelles absences
      'note',            // ✅ Pour les modifs de notes (Super Admin)
      'warn',            // ✅ Pour les nouveaux warns
      'success'
    ], 
    default: 'info' 
  },
  
  priority: { 
    type: String, 
    enum: ['low', 'medium', 'high'], 
    default: 'low' 
  },

  // ✅ Métadonnées pour stocker des infos contextuelles sans changer le schéma
  metadata: {
    targetId: { type: String },    // ID de la personne concernée (ex: DiscordId)
    actionBy: { type: String },    // Qui a fait l'action
    relatedId: { type: String },   // ID de l'objet lié (ex: ID de l'absence)
  },

  read: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now, index: { expires: '7d' } } // ✅ Auto-suppression après 7 jours pour ne pas encombrer la DB
});

export default mongoose.model("Notification", notificationSchema);