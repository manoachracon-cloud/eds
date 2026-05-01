import { NextRequest, NextResponse } from "next/server";
import { authErrorResponse, requireStaff } from "@/lib/adminAuth";
import { supabaseServer } from "@/lib/supabaseServer";

function jsonError(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

export async function POST(request: NextRequest) {
  try {
    await requireStaff(request, ["super_admin", "admin", "reception"]);
  } catch (error) {
    return authErrorResponse(error);
  }

  const body = await request.json().catch(() => null);

  if (!body?.notificationId) {
    return jsonError("notificationId est obligatoire.");
  }

  const { data, error } = await supabaseServer
    .from("notifications")
    .update({
      resolved_at: new Date().toISOString(),
      resolution_note: body.resolutionNote || "Erreur marquée comme résolue manuellement.",
      is_read: true,
      read_at: new Date().toISOString(),
      severity: "info"
    })
    .eq("id", body.notificationId)
    .select("id")
    .single();

  if (error || !data) {
    return jsonError(error?.message || "Notification introuvable.", 404);
  }

  return Response.json({
    ok: true,
    notificationId: data.id
  });
}
