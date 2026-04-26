// src/config/permissions.js
export const ROLE_PERMISSIONS = {
  SUPER_ADMIN: [
    "*",                // Bypass total (ton middleware gère déjà ça, mais c'est propre de le noter)
    "view_logs",
    "export_logs",
    "manage_logs",
    "manage_staff",     // ✅ Requis pour supprimer un staff (route DELETE /revoke)
    "warn_staff",       // ✅ Requis pour mettre des warns
    "manage_tickets",
    "view_stats",
    "edit_permissions",
    "view_server_status",
    "view_specs" 
  ],
  ADMIN: [
    "view_logs",
    "export_logs",
    "warn_staff",       // ✅ Ajouté : L'Admin peut désormais warner les Modérateurs
    "manage_tickets",
    "view_stats",
    "view_server_status"
  ],
  MODERATEUR: [
    "view_logs",
    "manage_tickets"
    // Le modérateur n'a pas "warn_staff", il ne peut donc pas sanctionner ses collègues
  ]
};