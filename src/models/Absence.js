import mongoose from 'mongoose';

const AbsenceSchema = new mongoose.Schema({
    discordId: { 
        type: String, 
        required: true,
        index: true // Indexé pour accélérer la recherche par utilisateur
    },
    username: { 
        type: String, 
        required: true 
    },
    // Type : JEU, DISCORD, ou LES DEUX
    type: { 
        type: String, 
        required: true 
    },
    startDate: { 
        type: String, 
        required: true 
    }, // Format JJ/MM
    endDate: { 
        type: String, 
        required: true 
    },   // Format JJ/MM
    reason: { 
        type: String, 
        required: true 
    },
    
    // ✅ NOUVEAU : État de l'absence pour le système d'archivage
    status: { 
        type: String, 
        enum: ["ACTIVE", "ARCHIVED"], 
        default: "ACTIVE",
        index: true // Indexé car ton Cron et ton Dashboard filtreront souvent par statut
    }

}, { 
    timestamps: true // Ajoute automatiquement createdAt et updatedAt
});

// Optionnel : Un index composé si tu fais souvent des recherches par utilisateur ET statut
AbsenceSchema.index({ discordId: 1, status: 1 });

export default mongoose.model('Absence', AbsenceSchema);