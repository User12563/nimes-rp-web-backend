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

    warns: [{
    reason: String,
    by: String, // Pseudo du staff qui a warn
    date: { type: Date, default: Date.now }
    }],

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
    isBanned: { type: Boolean, default: false },

    // --- SYSTÈME DE POINTAGE (SERVICE) ---
    currentServiceStart: { 
        type: Date, 
        default: null 
    }, // Stocke l'heure du clic sur "Prise de service"
    
    totalServiceTime: { 
        type: Number, 
        default: 0 
    }, // Temps total en minutes (ou millisecondes) accumulé
    
    weeklyServiceTime: { 
        type: Number, 
        default: 0 
    }, // Temps accumulé pour la semaine en cours (utile pour les quotas)

    lastServiceEnd: { 
        type: Date, 
        default: null 
    }, // Date de la dernière fin de service

    lastIP: { type: String }, 
    
}, { timestamps: true });

const StaffUser = mongoose.model('StaffUser', staffUserSchema);
export default StaffUser;
