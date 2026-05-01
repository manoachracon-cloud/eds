export type AdminRole =
  | "super_admin"
  | "admin"
  | "reception"
  | "employee_esthetic"
  | "coach_aquasport";

export const roleLabels: Record<AdminRole, string> = {
  super_admin: "Super Admin",
  admin: "Admin",
  reception: "Réception / Accueil",
  employee_esthetic: "Employé esthétique",
  coach_aquasport: "Coach Aqua-sports"
};

export const sectionPermissions: Record<AdminRole, string[]> = {
  super_admin: [
    "dashboard",
    "planning",
    "bookings",
    "requests",
    "services",
    "employees",
    "resources",
    "aquasport",
    "hours",
    "clients",
    "gift_cards",
    "analytics",
    "notifications",
    "system",
    "security",
    "settings"
  ],
  admin: [
    "dashboard",
    "planning",
    "bookings",
    "requests",
    "services",
    "employees",
    "resources",
    "aquasport",
    "hours",
    "clients",
    "gift_cards",
    "analytics",
    "notifications",
    "system",
    "settings"
  ],
  reception: [
    "dashboard",
    "planning",
    "bookings",
    "requests",
    "clients",
    "gift_cards",
    "notifications"
  ],
  employee_esthetic: ["dashboard", "planning", "bookings", "clients"],
  coach_aquasport: ["dashboard", "planning", "aquasport", "clients"]
};

export const sensitiveSections = new Set([
  "services",
  "employees",
  "resources",
  "hours",
  "analytics",
  "system",
  "security",
  "settings"
]);

export function canAccessSection(role: AdminRole | null | undefined, section: string) {
  if (!role) return false;
  return sectionPermissions[role]?.includes(section) || false;
}

export function getDefaultSection(role: AdminRole | null | undefined) {
  if (!role) return "dashboard";
  return sectionPermissions[role]?.[0] || "dashboard";
}

export function canWrite(role: AdminRole | null | undefined) {
  return role === "super_admin" || role === "admin" || role === "reception";
}

export function canManageSettings(role: AdminRole | null | undefined) {
  return role === "super_admin" || role === "admin";
}

export function canManageSecurity(role: AdminRole | null | undefined) {
  return role === "super_admin";
}
