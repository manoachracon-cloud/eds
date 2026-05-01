import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

function jsonError(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

function isValidEmail(email: string) {
  return /.+@.+\..+/.test(email);
}

async function getOrCreateClient(payload: {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  health?: string | null;
}) {
  const { data: existingClient } = await supabaseServer
    .from("clients")
    .select("id")
    .eq("email", payload.email)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingClient?.id) return existingClient.id as string;

  const { data: client, error } = await supabaseServer
    .from("clients")
    .insert({
      first_name: payload.firstName,
      last_name: payload.lastName,
      phone: payload.phone,
      email: payload.email,
      gdpr_consent: true,
      contraindications: payload.health || null
    })
    .select("id")
    .single();

  if (error || !client) {
    throw new Error(error?.message || "Impossible de créer la fiche client.");
  }

  return client.id as string;
}

export async function POST(request: NextRequest) {
  if (process.env.AQUASPORT_WAITLIST_ENABLED === "false") {
    return jsonError("La liste d’attente n’est pas activée.", 503);
  }

  const body = await request.json().catch(() => null);

  const aquasportClassId = body?.aquasportClassId?.trim();
  const firstName = body?.firstName?.trim();
  const lastName = body?.lastName?.trim();
  const phone = body?.phone?.trim();
  const email = body?.email?.trim().toLowerCase();

  if (!aquasportClassId || !firstName || !lastName || !phone || !email) {
    return jsonError("Champs obligatoires manquants.");
  }

  if (!isValidEmail(email)) {
    return jsonError("Adresse e-mail invalide.");
  }

  const { data: classRow } = await supabaseServer
    .from("aquasport_classes")
    .select("id,status")
    .eq("id", aquasportClassId)
    .single();

  if (!classRow) {
    return jsonError("Séance introuvable.", 404);
  }

  const clientId = await getOrCreateClient({
    firstName,
    lastName,
    phone,
    email,
    health: body.health || null
  });

  const { data, error } = await supabaseServer
    .from("aquasport_waitlist")
    .insert({
      aquasport_class_id: aquasportClassId,
      client_id: clientId,
      desired_level: body.level || null,
      health_notes: body.health || null,
      message: body.message || null,
      status: "waiting"
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") {
      return jsonError("Vous êtes déjà sur la liste d’attente de cette séance.", 409);
    }
    return jsonError(error.message, 500);
  }

  await supabaseServer.rpc("sync_aquasport_class_counts", { p_class_id: aquasportClassId });

  return NextResponse.json({
    ok: true,
    waitlistId: data.id
  });
}
