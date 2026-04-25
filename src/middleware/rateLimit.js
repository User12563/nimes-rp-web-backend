import rateLimit from "express-rate-limit";

export const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requêtes / minute
  message: { error: "Trop de requêtes, réessayez plus tard." }
});
