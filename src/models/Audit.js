import mongoose from "mongoose";

const auditSchema = new mongoose.Schema({
  // On stocke plus d'infos sur le staff pour l'affichage
  staff: {
    id: String,       // ID Discord (ex: 123456789)
    username: String, // Nom au moment de l'action
    avatar: String    // URL de l'avatar
  },
  action: String,     // Ex: "DELETE_LOG", "UPDATE_SETTING"
  details: Object,    // Les données envoyées dans la requête
  ip: String,         // Optionnel : pour la sécurité
  createdAt: { type: Date, default: Date.now }
});

const Audit = mongoose.model("Audit", auditSchema);
export default Audit;

// --- MIDDLEWARE D'AUDIT ---
export const auditAction = (actionName) => {
  return async (req, res, next) => {
    // On attend que la réponse soit finie pour être sûr que l'action a réussi
    res.on('finish', async () => {
      if (req.user && res.statusCode < 400) { // On n'audit que si ça a marché
        try {
          await Audit.create({
            staff: {
              id: req.user.discordId || req.user.id,
              username: req.user.username,
              avatar: req.user.avatar
            },
            action: actionName,
            details: req.body,
            ip: req.ip || req.headers['x-forwarded-for']
          });
        } catch (err) {
          console.error("❌ Erreur Audit Log:", err);
        }
      }
    });
    next();
  };
};
