import mongoose from 'mongoose';

const AbsenceSchema = new mongoose.Schema({
    discordId: { type: String, required: true },
    username: { type: String, required: true },
    // Type : JEU, DISCORD, ou LES DEUX
    type: { type: String, required: true },
    startDate: { type: String, required: true }, // On peut garder en String pour le format JJ/MM
    endDate: { type: String, required: true },
    reason: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
});

export default mongoose.model('Absence', AbsenceSchema);