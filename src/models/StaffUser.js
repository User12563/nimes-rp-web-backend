import mongoose from 'mongoose';

const staffUserSchema = new mongoose.Schema({
    // --- IDENTIFICATION DISCORD ---
    discordId: { 
        type: String, 
        required: true, 
        unique: true, 
        index: true 
    },
    
    // --- INFORMATIONS PROFIL ---
    username: { type: String, required: true },
    discriminator: { type: String },
    avatar: { type: String },
    
    // ✅ --- LIAISON ROBLOX ---
    robloxUsername: { type: String, default: null },
    robloxId: { 
        type: String, 
        default: null, 
        unique: true,
        sparse: true
    },
    robloxAvatar: { type: String, default: null }, // ✅ NOUVEAU CHAMP
    isLinked: { type: Boolean, default: false },

    // --- HIÉRARCHIE DU SITE ---
    role: { 
        type: String, 
        enum: ["SUPER_ADMIN", "ADMIN", "MODERATEUR"], 
        default: "MODERATEUR" 
    },

    // --- GESTION ÉQUIPE & NOTES ---
    status: { 
        type: String, 
        enum: ["ONLINE", "OFFLINE", "SERVICE"], 
        default: "OFFLINE" 
    },
    notes: { 
        type: String, 
        default: "" 
    },

    // --- STATISTIQUES & SUIVI ---
    lastLogin: { type: Date, default: Date.now },
    isBanned: { type: Boolean, default: false }
    
}, { timestamps: true });

const StaffUser = mongoose.model('StaffUser', staffUserSchema);
export default StaffUser;
