import jwt from 'jsonwebtoken';
import { promisify } from 'util';

// ATTENTION : Ne jamais laisser de clé par défaut en clair ici.
// Si process.env.JWT_SECRET est absent, le serveur doit s'arrêter ou throw une erreur.
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  console.error("CRITICAL ERROR: JWT_SECRET is not defined in environment variables!");
  process.exit(1); // Arrête le serveur si la sécurité n'est pas configurée
}

export const generateToken = (payload) => {
  // SÉCURITÉ : On s'assure que le payload ne contient QUE des infos non sensibles (ID, rôle)
  // Ne jamais passer l'objet "user" complet ici.
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
};

export const verifyToken = (token) => {
  return new Promise((resolve, reject) => {
    jwt.verify(token, JWT_SECRET, (err, decoded) => {
      if (err) reject(err);
      resolve(decoded);
    });
  });
};

export default { generateToken, verifyToken };
