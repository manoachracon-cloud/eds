import { NextRequest, NextResponse } from "next/server";
import { authErrorResponse, requireStaff } from "@/lib/adminAuth";
import { supabaseServer } from "@/lib/supabaseServer";
import {
  aquasportClassCancelledEmail,
  aquasportClassUpdatedEmail,
  internalAquasportNotificationEmail
} from "@/lib/aquasportNotificationTemplates";

function jsonError(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

function enabled() {
  return process.env.AQUASPORT_GROUP_NOTIFICATIONS_ENABLED !== "false";
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

async function getClass(classId: string) {
  const { data, error } = await supabaseServer
    .from("aquasport_classes")
    .select(
      "id,title,level,status,start_at,end_at,capacity_max,registered_count,waitlist_count,instructions,cancellation_reason,service_id,coach_employee_id,resource_id,services(name),employees(public_display_name,role_title),resources(name)"
    )
    .eq("id", classId)
    .single();

  if (error || !data) {
    throw new Error(error?.message || "Séance introuvable.");
  }

  return data as any;
}

async function getParticipants(classId: string) {
  const { data, error } = await supabaseServer
    .from("aquasport_participants")
    .select("id,client_id,booking_id,attendance_status,clients(first_name,last_name,email,phone),bookings(booking_reference,management_token,status)")
    .eq("aquasport_class_id", classId)
    .in("attendance_status", ["registered", "present"]);

  if (error) {
    throw new Error(error.message);
  }

  return (data || []) as any[];
}

async function logNotification(input: {
  bookingId?: string | null;
  clientId?: string | null;
  recipient: string;
  subject: string;
  html: string;
  status: "sent" | "failed";
  providerMessageId?: string;
  failedReason?: string;
  channel?: "email" | "internal";
}) {
  await supabaseServer.from("notifications").insert({
    booking_id: input.bookingId || null,
    client_id: input.clientId || null,
    channel: input.channel || "email",
    recipient: input.recipient,
    subject: input.subject,
    message: input.html,
    status: input.status,
    provider: "resend",
    provider_message_id: input.providerMessageId,
    sent_at: input.status === "sent" ? new Date().toISOString() : null,
    failed_reason: input.failedReason || null
  });
}

async function notifyParticipants({
  oldClass,
  newClass,
  type,
  reason
}: {
  oldClass: any;
  newClass: any;
  type: "cancelled" | "updated";
  reason?: string | null;
}) {
  if (!enabled()) {
    return { enabled: false, sent: 0, failed: 0 };
  }

  const participants = await getParticipants(newClass.id);
  let sent = 0;
  let failed = 0;

  for (const participant of participants) {
    const email = participant.clients?.email;
    if (!email) continue;

    const payload = {
      clientFirstName: participant.clients?.first_name,
      clientLastName: participant.clients?.last_name,
      classTitle: newClass.title,
      serviceName: newClass.services?.name || "Aqua-sports",
      coachName: newClass.employees?.public_display_name || null,
      dateLabel: formatDateLabel(newClass.start_at),
      timeLabel: formatTimeLabel(newClass.start_at),
      endTimeLabel: formatTimeLabel(newClass.end_at),
      oldDateLabel: oldClass?.start_at ? formatDateLabel(oldClass.start_at) : null,
      oldTimeLabel: oldClass?.start_at ? formatTimeLabel(oldClass.start_at) : null,
      reason,
      instructions: newClass.instructions || null,
      managementUrl: participant.bookings?.management_token
        ? `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/reservation/${participant.bookings.management_token}`
        : null
    };

    const emailTemplate =
      type === "cancelled"
        ? aquasportClassCancelledEmail(payload)
        : aquasportClassUpdatedEmail(payload);

    const result = await sendEmail({
      to: email,
      subject: emailTemplate.subject,
      html: emailTemplate.html
    });

    await logNotification({
      bookingId: participant.booking_id,
      clientId: participant.client_id,
      recipient: email,
      subject: emailTemplate.subject,
      html: emailTemplate.html,
      status: result.error ? "failed" : "sent",
      providerMessageId: result.data?.id,
      failedReason: result.error
    });

    if (result.error) failed += 1;
    else sent += 1;
  }

  const internalRecipient = process.env.INTERNAL_NOTIFICATION_EMAIL;
  if (internalRecipient) {
    const internal = internalAquasportNotificationEmail({
      title: type === "cancelled" ? "Séance Aqua-sports annulée" : "Séance Aqua-sports modifiée",
      message:
        type === "cancelled"
          ? "Les participants ont été notifiés de l’annulation."
          : "Les participants ont été notifiés de la modification.",
      classTitle: newClass.title,
      dateLabel: formatDateLabel(newClass.start_at),
      timeLabel: formatTimeLabel(newClass.start_at),
      recipientsCount: participants.length
    });

    const result = await sendEmail({
      to: internalRecipient,
      subject: internal.subject,
      html: internal.html
    });

    await logNotification({
      recipient: internalRecipient,
      subject: internal.subject,
      html: internal.html,
      status: result.error ? "failed" : "sent",
      providerMessageId: result.data?.id,
      failedReason: result.error,
      channel: "internal"
    });
  }

  await supabaseServer
    .from("aquasport_classes")
    .update({
      last_notified_at: new Date().toISOString(),
      last_notification_type: type
    })
    .eq("id", newClass.id);

  return { enabled: true, sent, failed };
}

export async function POST(request: NextRequest) {
  try {
    await requireStaff(request, ["super_admin", "admin", "coach_aquasport"]);
  } catch (error) {
    return authErrorResponse(error);
  }

  const body = await request.json().catch(() => null);

  if (!body?.classId || !body?.payload) {
    return jsonError("classId et payload sont obligatoires.");
  }

  const oldClass = await getClass(body.classId);
  const updatePayload = body.payload;

  const oldStart = oldClass.start_at;
  const oldEnd = oldClass.end_at;
  const oldStatus = oldClass.status;

  const { error } = await supabaseServer
    .from("aquasport_classes")
    .update(updatePayload)
    .eq("id", body.classId);

  if (error) {
    return jsonError(error.message, 500);
  }

  if (updatePayload.status === "cancelled") {
    await supabaseServer
      .from("bookings")
      .update({
        status: "cancelled",
        cancelled_at: new Date().toISOString(),
        cancellation_reason: updatePayload.cancellation_reason || "Séance Aqua-sports annulée"
      })
      .eq("aquasport_class_id", body.classId)
      .in("status", ["pending", "confirmed"]);
  }

  await supabaseServer.rpc("sync_aquasport_class_counts", { p_class_id: body.classId });
  const newClass = await getClass(body.classId);

  const statusChangedToCancelled =
    updatePayload.status === "cancelled" && oldStatus !== "cancelled";

  const scheduleChanged =
    Boolean(updatePayload.start_at || updatePayload.end_at) &&
    (oldStart !== newClass.start_at || oldEnd !== newClass.end_at) &&
    newClass.status !== "cancelled";

  let notificationResult = { enabled: enabled(), sent: 0, failed: 0 };

  if (statusChangedToCancelled) {
    notificationResult = await notifyParticipants({
      oldClass,
      newClass,
      type: "cancelled",
      reason: updatePayload.cancellation_reason || body.reason || null
    });
  } else if (scheduleChanged) {
    notificationResult = await notifyParticipants({
      oldClass,
      newClass,
      type: "updated"
    });
  }

  return NextResponse.json({
    ok: true,
    class: newClass,
    notifications: notificationResult
  });
}
