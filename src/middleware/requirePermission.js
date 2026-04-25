// src/middleware/requirePermission.js

export const requirePermission = (requiredPermission) => {
  return (req, res, next) => {
    // Si c'est un SUPER_ADMIN, on bypass la vérification
    if (req.user?.role === "SUPER_ADMIN") return next();

    const userPermissions = req.user?.permissions || [];
    if (!userPermissions.includes(requiredPermission)) {
      return res.status(403).json({ 
        error: "Accès interdit", 
        message: `Permission manquante : ${requiredPermission}` 
      });
    }
    next();
  };
};
