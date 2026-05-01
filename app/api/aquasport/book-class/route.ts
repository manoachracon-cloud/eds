import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { customerConfirmationEmail, internalNotificationEmail } from "@/lib/emailTemplates";

type Payload = {
  aquasportClassId?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  email?: string;
  level?: string;
  health?: string;
  comment?: string;
  consent?: boolean;
};

function jsonError(message: string, status = 400, extra: Record<string, unknown> = {}) {
  return NextResponse.json({ ok: false, error: message, ...extra }, { status });
}

function isValidEmail(email: string) {
  return /.+@.+\..+/.test(email);
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

function formatPrice(cents: number) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0
  }).format(cents / 100);
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
    return {
      skipped: true,
      error: "RESEND_API_KEY ou RESEND_FROM_EMAIL manquant."
    };
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject,
      html
    })
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    return {
      skipped: false,
      error: data?.message || data?.error || "Erreur Resend.",
      providerResponse: data
    };
  }

  return {
    skipped: false,
    data
  };
}

async function getOrCreateClient({
  firstName,
  lastName,
  phone,
  email,
  health
}: {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  health?: string | null;
}) {
  const { data: existingClient } = await supabaseServer
    .from("clients")
    .select("id")
    .eq("email", email)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingClient?.id) {
    await supabaseServer
      .from("clients")
      .update({
        first_name: firstName,
        last_name: lastName,
        phone,
        gdpr_consent: true,
        contraindications: health || null
      })
      .eq("id", existingClient.id);

    return existingClient.id as string;
  }

  const { data: createdClient, error } = await supabaseServer
    .from("clients")
    .insert({
      first_name: firstName,
      last_name: lastName,
      phone,
      email,
      gdpr_consent: true,
      contraindications: health || null
    })
    .select("id")
    .single();

  if (error || !createdClient) {
    throw new Error(error?.message || "Impossible de créer la fiche client.");
  }

  return createdClient.id as string;
}

async function logNotification({
  bookingId,
  clientId,
  employeeId,
  recipient,
  subject,
  html,
  status,
  providerMessageId,
  failedReason,
  channel = "email"
}: {
  bookingId?: string | null;
  clientId?: string | null;
  employeeId?: string | null;
  recipient: string;
  subject: string;
  html: string;
  status: "sent" | "failed";
  providerMessageId?: string;
  failedReason?: string;
  channel?: "email" | "internal";
}) {
  await supabaseServer.from("notifications").insert({
    booking_id: bookingId || null,
    client_id: clientId || null,
    employee_id: employeeId || null,
    channel,
    recipient,
    subject,
    message: html,
    status,
    provider: "resend",
    provider_message_id: providerMessageId,
    sent_at: status === "sent" ? new Date().toISOString() : null,
    failed_reason: failedReason || null
  });
}

export async function POST(request: NextRequest) {
  const payload = (await request.json().catch(() => null)) as Payload | null;

  if (!payload) {
    return jsonError("Payload JSON invalide.");
  }

  const aquasportClassId = payload.aquasportClassId?.trim();
  const firstName = payload.firstName?.trim();
  const lastName = payload.lastName?.trim();
  const phone = payload.phone?.trim();
  const email = payload.email?.trim().toLowerCase();

  if (!aquasportClassId || !firstName || !lastName || !phone || !email) {
    return jsonError("Champs obligatoires manquants.");
  }

  if (!payload.consent) {
    return jsonError("Le consentement RGPD est obligatoire.");
  }

  if (!isValidEmail(email)) {
    return jsonError("Adresse e-mail invalide.");
  }

  const { data: classRow, error: classError } = await supabaseServer
    .from("aquasport_classes")
    .select(
      "id,title,level,status,start_at,end_at,capacity_max,registered_count,waitlist_count,instructions,service_id,coach_employee_id,resource_id,services(id,name,price_cents,duration_minutes),employees(public_display_name,role_title),resources(id,name)"
    )
    .eq("id", aquasportClassId)
    .single();

  if (classError || !classRow) {
    return jsonError("Séance Aqua-sports introuvable.", 404);
  }

  if (!["open"].includes(classRow.status)) {
    return jsonError("Cette séance n’est plus ouverte à la réservation.", 409, {
      classStatus: classRow.status
    });
  }

  if (new Date(classRow.start_at).getTime() <= Date.now()) {
    return jsonError("Cette séance est déjà passée.", 409);
  }

  if ((classRow.registered_count || 0) >= classRow.capacity_max) {
    await supabaseServer.rpc("sync_aquasport_class_counts", { p_class_id: classRow.id });
    return jsonError("Cette séance est complète. Vous pouvez rejoindre la liste d’attente.", 409, {
      waitlistAvailable: true
    });
  }

  const clientId = await getOrCreateClient({
    firstName,
    lastName,
    phone,
    email,
    health: payload.health || null
  });

  const { data: alreadyParticipant } = await supabaseServer
    .from("aquasport_participants")
    .select("id")
    .eq("aquasport_class_id", classRow.id)
    .eq("client_id", clientId)
    .maybeSingle();

  if (alreadyParticipant) {
    return jsonError("Ce client est déjà inscrit à cette séance.", 409);
  }

  const durationMinutes = Math.max(
    Math.round((new Date(classRow.end_at).getTime() - new Date(classRow.start_at).getTime()) / 60000),
    classRow.services?.duration_minutes || 45
  );

  const { data: booking, error: bookingError } = await supabaseServer
    .from("bookings")
    .insert({
      client_id: clientId,
      service_id: classRow.service_id,
      employee_id: classRow.coach_employee_id,
      aquasport_class_id: classRow.id,
      resource_id: classRow.resource_id || null,
      start_at: classRow.start_at,
      end_at: classRow.end_at,
      duration_minutes: durationMinutes,
      price_cents: classRow.services?.price_cents || 0,
      payment_status: "unpaid",
      payment_due_cents: classRow.services?.price_cents || 0,
      status: "confirmed",
      client_comment: `Niveau : ${payload.level || "non renseigné"}. ${payload.comment || ""} ${
        payload.health ? `Santé : ${payload.health}` : ""
      }`.trim()
    })
    .select("id,booking_reference,management_token,start_at,end_at,status,duration_minutes,price_cents")
    .single();

  if (bookingError || !booking) {
    return jsonError(bookingError?.message || "Impossible de créer la réservation.", 500);
  }

  const { error: participantError } = await supabaseServer.from("aquasport_participants").insert({
    aquasport_class_id: classRow.id,
    booking_id: booking.id,
    client_id: clientId,
    attendance_status: "registered",
    health_notes: payload.health || null
  });

  if (participantError) {
    await supabaseServer.from("bookings").update({ status: "cancelled" }).eq("id", booking.id);
    return jsonError(participantError.message, 500);
  }

  await supabaseServer.rpc("sync_aquasport_class_counts", { p_class_id: classRow.id });

  const emailPayload = {
    bookingReference: booking.booking_reference,
    clientFirstName: firstName,
    clientLastName: lastName,
    clientPhone: phone,
    clientEmail: email,
    serviceName: `${classRow.services?.name || "Aqua-sports"} — ${classRow.title}`,
    employeeName: classRow.employees?.public_display_name || null,
    dateLabel: formatDateLabel(classRow.start_at),
    timeLabel: formatTimeLabel(classRow.start_at),
    durationMinutes,
    priceLabel: formatPrice(classRow.services?.price_cents || 0),
    comment: payload.comment || null,
    managementUrl: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/reservation/${booking.management_token}`
  };

  const customerEmail = customerConfirmationEmail(emailPayload);
  const customerResult = await sendEmail({
    to: email,
    subject: customerEmail.subject,
    html: customerEmail.html
  });

  await logNotification({
    bookingId: booking.id,
    clientId,
    employeeId: classRow.coach_employee_id,
    recipient: email,
    subject: customerEmail.subject,
    html: customerEmail.html,
    status: customerResult.error ? "failed" : "sent",
    providerMessageId: customerResult.data?.id,
    failedReason: customerResult.error
  });

  const internalRecipient = process.env.INTERNAL_NOTIFICATION_EMAIL;

  if (internalRecipient) {
    const internalEmail = internalNotificationEmail(emailPayload);
    const internalResult = await sendEmail({
      to: internalRecipient,
      subject: internalEmail.subject,
      html: internalEmail.html
    });

    await logNotification({
      bookingId: booking.id,
      clientId,
      employeeId: classRow.coach_employee_id,
      recipient: internalRecipient,
      subject: internalEmail.subject,
      html: internalEmail.html,
      status: internalResult.error ? "failed" : "sent",
      providerMessageId: internalResult.data?.id,
      failedReason: internalResult.error,
      channel: "internal"
    });
  }

  return NextResponse.json({
    ok: true,
    booking: {
      ...booking,
      aquasport_class: classRow
    },
    notifications: {
      customerEmail: customerResult.error ? "failed" : "sent"
    }
  });
}
