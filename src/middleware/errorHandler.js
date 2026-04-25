import mongoose from "mongoose";
import { logger } from "../utils/logger.js";

export const errorHandler = (err, req, res, next) => {
  // Log complet côté serveur
  logger.error(err.stack);

  // 1) Erreurs Joi (validation)
  if (err.isJoi) {
    return res.status(400).json({
      error: err.details[0].message
    });
  }

  // 2) Erreurs MongoDB : ObjectId invalide
  if (err instanceof mongoose.Error.CastError) {
    return res.status(400).json({
      error: "ID invalide"
    });
  }

  // 3) Erreurs MongoDB : doublons (E11000)
  if (err.code === 11000) {
    return res.status(400).json({
      error: "Cet élément existe déjà"
    });
  }

  // 4) Erreurs personnalisées (throw new Error("..."))
  if (err.status) {
    return res.status(err.status).json({
      error: err.message
    });
  }

  // 5) Erreur inconnue → 500
  return res.status(500).json({
    error: "Erreur interne du serveur"
  });
};
