import { NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

export type AdminRole =
  | "super_admin"
  | "admin"
  | "reception"
  | "employee_esthetic"
  | "coach_aquasport";

export type AuthenticatedStaff = {
  userId: string;
  email: string | null;
  role: AdminRole;
  displayName: string;
};

export class AdminAuthError extends Error {
  status: number;

  constructor(message: string, status = 401) {
    super(message);
    this.status = status;
  }
}

export const ROLE_LABELS: Record<AdminRole, string> = {
  super_admin: "Super Admin",
  admin: "Admin",
  reception: "Réception",
  employee_esthetic: "Employé esthétique",
  coach_aquasport: "Coach Aqua-sports"
};

export const ROLE_SECTIONS: Record<AdminRole, string[]> = {
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

export function hasRole(role: AdminRole, allowedRoles: AdminRole[]) {
  return allowedRoles.includes(role);
}

export function canAccessSection(role: AdminRole, section: string) {
  return ROLE_SECTIONS[role]?.includes(section) || false;
}

export function getBearerToken(request: NextRequest) {
  const authorization = request.headers.get("authorization") || "";
  if (!authorization.startsWith("Bearer ")) return null;
  return authorization.replace("Bearer ", "").trim();
}

export async function requireStaff(
  request: NextRequest,
  allowedRoles: AdminRole[] = ["super_admin", "admin", "reception", "employee_esthetic", "coach_aquasport"]
): Promise<AuthenticatedStaff> {
  const token = getBearerToken(request);

  if (!token) {
    throw new AdminAuthError("Session admin manquante.", 401);
  }

  const { data: userData, error: userError } = await supabaseServer.auth.getUser(token);

  if (userError || !userData.user) {
    throw new AdminAuthError("Session admin invalide ou expirée.", 401);
  }

  const { data: profile, error: profileError } = await supabaseServer
    .from("user_profiles")
    .select("user_id,role,first_name,last_name,is_active")
    .eq("user_id", userData.user.id)
    .maybeSingle();

  if (profileError) {
    throw new AdminAuthError(profileError.message, 500);
  }

  if (!profile || !profile.is_active) {
    throw new AdminAuthError("Compte interne inactif ou introuvable.", 403);
  }

  if (!allowedRoles.includes(profile.role)) {
    throw new AdminAuthError("Permission insuffisante.", 403);
  }

  return {
    userId: userData.user.id,
    email: userData.user.email || null,
    role: profile.role,
    displayName: `${profile.first_name || ""} ${profile.last_name || ""}`.trim() || ROLE_LABELS[profile.role as AdminRole]
  };
}

export function authErrorResponse(error: unknown) {
  const knownError = error as AdminAuthError;
  return Response.json(
    {
      ok: false,
      error: knownError.message || "Accès refusé."
    },
    {
      status: knownError.status || 403
    }
  );
}
