// src/middleware/auth.js
export const auth = (req, res, next) => {
    if (req.isAuthenticated()) return next();
    res.status(401).json({ error: "NON_AUTHENTIFIÉ" });
};

export const requireRole = (role) => {
    return (req, res, next) => {
        if (req.user && req.user.role === role) return next();
        res.status(403).json({ error: "ACCÈS_INTERDIT" });
    };
};
