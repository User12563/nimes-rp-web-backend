🟩 README — Backend du Dashboard Staff
🚀 Présentation
Ce backend alimente un dashboard staff complet pour un serveur (jeu, communauté, projet).
Il fournit :

un système d’authentification sécurisé

une gestion avancée des rôles et permissions

un module de logs professionnel

un système de tickets complet

un audit interne des actions staff

une API REST propre et structurée

une communication temps réel via Socket.io

une intégration avec un bot Discord

Le tout est construit avec Node.js + Express + MongoDB + Socket.io.

🛠️ Technologies utilisées
Node.js / Express — API REST

MongoDB / Mongoose — base de données

Socket.io — temps réel

JWT — authentification

Winston — logs système

Helmet + CORS — sécurité

Rate limiting — protection anti‑abus

Discord.js — bot Discord (intégré)

🔐 Authentification & Sécurité
Authentification via JWT

Permissions avancées par rôle

Middleware auth + requirePermission

Rate limiting global

Helmet activé

CORS configuré

Validation des données (Joi)

Gestion des erreurs centralisée

👥 Rôles & Permissions
Chaque staff possède un rôle :

superadmin

admin

mod

Chaque rôle dispose d’un ensemble de permissions définies dans :

Code
src/config/permissions.js
Les routes sensibles utilisent :

js
auth
requirePermission("permission_name")
📜 Logs (professionnels)
Le backend gère :

la réception des logs (via bot Discord)

l’anti‑duplication

l’indexation MongoDB

la pagination

les exports CSV/Excel

les stats avancées

la suppression sécurisée (avec audit)

la diffusion temps réel via Socket.io

Les logs système sont séparés :

Code
logs/app.log
logs/errors.log
logs/security.log
logs/discord.log
🎫 Tickets (système complet)
Chaque ticket contient :

statut (open, in_progress, closed)

assignation à un staff

commentaires internes

historique des actions

mise à jour en temps réel via Socket.io

Les tickets sont paginés et filtrables.

📝 Audit interne
Chaque action staff sensible est enregistrée :

création / suppression

gestion des permissions

actions sur les logs

actions sur les tickets

Stocké dans la collection Audit.

🔌 Socket.io
Socket.io est utilisé pour :

les nouveaux logs

les mises à jour de tickets

les stats en temps réel

Connexion sécurisée via JWT :

js
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  // vérification JWT
});
🤖 Bot Discord intégré
Le bot Discord envoie :

les logs

les actions staff

les événements importants

Vers le backend via API + Socket.io.

📁 Structure du projet
Code
backend/
├── package.json               # Dépendances (Express, Mongoose, Socket.io, Discord.js)
├── README.md                  # Documentation + installation + structure
│
└── src/
    ├── server.js              # Express + Socket.io (auth JWT) + CORS + Helmet
    ├── discordBot.js          # Bot Discord → envoi des logs en temps réel
    ├── createSuperAdmin.js    # Script pour créer le premier superadmin
    │
    ├── config/
    │   └── permissions.js     # Permissions par rôle (superadmin/admin/mod)
    │
    ├── middleware/
    │   ├── auth.js            # Vérification JWT → req.user
    │   ├── requirePermission.js# Vérifie les permissions staff
    │   ├── rateLimit.js       # Anti-spam / anti-abus
    │   ├── audit.js           # Audit interne des actions staff
    │   └── errorHandler.js    # Gestion centralisée des erreurs
    │
    ├── models/
    │   ├── StaffUser.js       # Staff (username, password, role, accessKey)
    │   ├── Tickets.js         # Tickets (assignation, statut, commentaires, historique)
    │   ├── Logs.js            # Logs Discord (ban, kick, véhicules, actions staff)
    │   └── Audit.js           # Audit des actions sensibles
    │
    ├── routes/
    │   ├── auth.js            # POST /auth/login (JWT)
    │   ├── logs.js            # GET /logs + export CSV/Excel
    │   ├── logs-stats.js      # GET /logs/stats/* (stats + graphiques)
    │   ├── tickets.js         # CRUD tickets + assignation + commentaires
    │   ├── staff.js           # Gestion staff (CRUD + permissions)
    │   └── audit.js           # GET /audit (historique des actions staff)
    │
    └── utils/
        └── logger.js          # Winston multi-fichiers (app/error/security/discord)

🎯 Usage :

🚀 Lancement
Créer un fichier .env :

Code
MONGO_URI=...
JWT_SECRET=...
DISCORD_TOKEN=...
PORT=5000
Installer les dépendances :

Code
npm install
Lancer le serveur :

Code
npm start
📌 Statut du backend
✔️ 100% fonctionnel
✔️ Sécurisé
✔️ Structuré
✔️ Prêt pour le frontend
✔️ Prêt pour la production