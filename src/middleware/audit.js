import Audit from "../models/Audit.js";

export const audit = (action) => {
  return async (req, res, next) => {
    try {
      await Audit.create({
        staff: req.user.username,
        action,
        details: req.body
      });
    } catch (err) {
      console.error("Erreur audit :", err);
    }
    next();
  };
};
