import winston from "winston";

export const logger = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),

    // Logs généraux
    new winston.transports.File({ filename: "logs/app.log", level: "info" }),

    // Erreurs
    new winston.transports.File({ filename: "logs/errors.log", level: "error" }),

    // Sécurité (permissions refusées, tentatives suspectes)
    new winston.transports.File({ filename: "logs/security.log", level: "warn" }),

    // Logs Discord (événements du bot)
    new winston.transports.File({ filename: "logs/discord.log", level: "verbose" })
  ]
});
