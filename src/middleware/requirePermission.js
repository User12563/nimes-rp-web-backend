import { ROLE_PERMISSIONS } from "../config/permissions.js";

export const requirePermission = (requiredPermission) => {
  return (req, res, next) => {
    const user = req.user; // Récupéré par ton middleware d'auth (passport ou jwt)

    if (!user) {
      return res.status(401).json({ error: "Non authentifié" });
    }

    // 1. Accès total pour le SUPER_ADMIN
    if (user.role === "SUPER_ADMIN") {
      return next();
    }

    // 2. On récupère la liste des permissions associées au rôle dans ton fichier config
    const permissionsDuRole = ROLE_PERMISSIONS[user.role] || [];

    // 3. Vérification : l'utilisateur a-t-il la permission via son rôle ?
    // On vérifie aussi s'il l'a en BDD au cas où (fallback)
    const hasAccess = 
      permissionsDuRole.includes(requiredPermission) || 
      (user.permissions && user.permissions.includes(requiredPermission));

    if (!hasAccess) {
      return res.status(403).json({ 
        error: "Accès interdit", 
        message: `Le rôle ${user.role} n'a pas la permission : ${requiredPermission}` 
      });
    }

    next();
  };
};