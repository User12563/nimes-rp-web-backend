// src/config/permissions.js
export const ROLE_PERMISSIONS = {
  SUPER_ADMIN: [
    "view_logs",
    "export_logs",
    "manage_logs",
    "manage_staff",
    "manage_tickets",
    "view_stats",
    "edit_permissions",
    "view_server_status",
    "view_specs" // Ajoute celui-ci pour tes graphiques CPU/RAM
  ],
  ADMIN: [
    "view_logs",
    "export_logs",
    "manage_tickets",
    "view_stats",
    "view_server_status"
  ],
  MODERATEUR: [
    "view_logs",
    "manage_tickets"
  ]
};
