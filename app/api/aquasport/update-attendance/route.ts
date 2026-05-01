import { NextRequest, NextResponse } from "next/server";
import { authErrorResponse, requireStaff } from "@/lib/adminAuth";
import { supabaseServer } from "@/lib/supabaseServer";
import { aquasportWaitlistPlaceAvailableEmail } from "@/lib/aquasportNotificationTemplates";

function jsonError(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

function waitlistEnabled() {
  return process.env.AQUASPORT_WAITLIST_AUTO_NOTIFY_ENABLED !== "false";
}

function formatDateLabel(value: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "America/Guadeloupe"
  }).format(new Date(value));
}

function formatTimeLabel(value: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Guadeloupe"
  }).format(new Date(value));
}

async function sendEmail({
  to,
  subject,
  html
}: {
  to: string;
  subject: string;
  html: string;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;

  if (!apiKey || !from) {
    return { error: "RESEND_API_KEY ou RESEND_FROM_EMAIL manquant." };
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ from, to: [to], subject, html })
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    return { error: data?.message || data?.error || "Erreur Resend.", data };
  }

  return { data };
}

async function notifyFirstWaitlist(classId: string) {
  if (!waitlistEnabled()) {
    return { enabled: false, notified: false };
  }

  const { data: classRow, error: classError } = await supabaseServer
    .from("aquasport_classes")
    .select("id,title,start_at,end_at,capacity_max,registered_count,status,services(name),employees(public_display_name)")
    .eq("id", classId)
    .single();

  if (classError || !classRow) {
    throw new Error(classError?.message || "Séance introuvable.");
  }

  if (!["open", "full"].includes(classRow.status)) {
    return { enabled: true, notified: false, reason: "class_not_open" };
  }

  if ((classRow.registered_count || 0) >= classRow.capacity_max) {
    return { enabled: true, notified: false, reason: "still_full" };
  }

  const { data: waiter } = await supabaseServer
    .from("aquasport_waitlist")
    .select("id,client_id,clients(first_name,last_name,email,phone)")
    .eq("aquasport_class_id", classId)
    .eq("status", "waiting")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!waiter?.clients?.email) {
    return { enabled: true, notified: false, reason: "no_waiter" };
  }

  const email = aquasportWaitlistPlaceAvailableEmail({
    clientFirstName: waiter.clients.first_name,
    clientLastName: waiter.clients.last_name,
    classTitle: classRow.title,
    serviceName: classRow.services?.name || "Aqua-sports",
    coachName: classRow.employees?.public_display_name || null,
    dateLabel: formatDateLabel(classRow.start_at),
    timeLabel: formatTimeLabel(classRow.start_at),
    endTimeLabel: formatTimeLabel(classRow.end_at)
  });

  const result = await sendEmail({
    to: waiter.clients.email,
    subject: email.subject,
    html: email.html
  });

  await supabaseServer.from("notifications").insert({
    client_id: waiter.client_id,
    channel: "email",
    recipient: waiter.clients.email,
    subject: email.subject,
    message: email.html,
    status: result.error ? "failed" : "sent",
    provider: "resend",
    provider_message_id: result.data?.id,
    sent_at: result.error ? null : new Date().toISOString(),
    failed_reason: result.error || null
  });

  await supabaseServer
    .from("aquasport_waitlist")
    .update({
      status: "contacted",
      contacted_at: new Date().toISOString(),
      last_notified_at: new Date().toISOString(),
      last_notification_type: "place_available"
    })
    .eq("id", waiter.id);

  return {
    enabled: true,
    notified: !result.error,
    failed: Boolean(result.error)
  };
}

export async function POST(request: NextRequest) {
  try {
    await requireStaff(request, ["super_admin", "admin", "coach_aquasport"]);
  } catch (error) {
    return authErrorResponse(error);
  }

  const body = await request.json().catch(() => null);

  if (!body?.participantId || !body?.classId || !body?.attendanceStatus) {
    return jsonError("participantId, classId et attendanceStatus sont obligatoires.");
  }

  const { error } = await supabaseServer
    .from("aquasport_participants")
    .update({ attendance_status: body.attendanceStatus })
    .eq("id", body.participantId);

  if (error) {
    return jsonError(error.message, 500);
  }

  await supabaseServer.rpc("sync_aquasport_class_counts", { p_class_id: body.classId });

  let waitlistNotification = { enabled: waitlistEnabled(), notified: false } as any;

  if (body.attendanceStatus === "cancelled") {
    waitlistNotification = await notifyFirstWaitlist(body.classId);
    await supabaseServer.rpc("sync_aquasport_class_counts", { p_class_id: body.classId });
  }

  return NextResponse.json({
    ok: true,
    waitlistNotification
  });
}
