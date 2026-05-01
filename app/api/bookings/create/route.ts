import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import {
  customerConfirmationEmail,
  internalNotificationEmail
} from "@/lib/emailTemplates";
import {
  buildCalendarEventDescription,
  createGoogleCalendarEvent,
  isGoogleCalendarEnabled
} from "@/lib/googleCalendar";
import {
  isWhatsAppEnabled,
  sendInternalWhatsAppBookingNotification
} from "@/lib/whatsapp";

type CreateBookingPayload = {
  serviceId?: string;
  date?: string;
  time?: string;
  employeeId?: string | null;
  firstName?: string;
  lastName?: string;
  phone?: string;
  email?: string;
  comment?: string;
  level?: string;
  health?: string;
  giftCardCode?: string;
  consent?: boolean;
};

function jsonError(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

function isValidEmail(email: string) {
  return /.+@.+\..+/.test(email);
}

function toGuadeloupeIso(date: string, time: string) {
  return new Date(`${date}T${time}:00-04:00`).toISOString();
}

function formatDateLabel(date: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "America/Guadeloupe"
  }).format(new Date(`${date}T12:00:00-04:00`));
}

function formatPrice(cents: number) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0
  }).format(cents / 100);
}

function normalizeGiftCardCode(value?: string) {
  return String(value || "").trim().toUpperCase();
}

function giftCardRedemptionEnabled() {
  return process.env.GIFT_CARD_REDEMPTION_ENABLED !== "false";
}

async function findAvailableResource({
  serviceId,
  startAt,
  endAt
}: {
  serviceId: string;
  startAt: string;
  endAt: string;
}) {
  const { data: linkedResources, error } = await supabaseServer
    .from("resource_services")
    .select("resources(id,name,is_active,is_bookable)")
    .eq("service_id", serviceId);

  if (error) {
    throw new Error(error.message);
  }

  const resources = (linkedResources || [])
    .map((row: any) => row.resources)
    .filter((resource: any) => resource?.is_active && resource?.is_bookable);

  if (resources.length === 0) {
    return null;
  }

  for (const resource of resources) {
    const [{ data: bookingConflict }, { data: timeOffConflict }] = await Promise.all([
      supabaseServer
        .from("bookings")
        .select("id")
        .eq("resource_id", resource.id)
        .in("status", ["pending", "confirmed"])
        .lt("start_at", endAt)
        .gt("end_at", startAt)
        .limit(1)
        .maybeSingle(),
      supabaseServer
        .from("resource_time_off")
        .select("id")
        .eq("resource_id", resource.id)
        .lt("start_at", endAt)
        .gt("end_at", startAt)
        .limit(1)
        .maybeSingle()
    ]);

    if (!bookingConflict && !timeOffConflict) {
      return resource;
    }
  }

  throw new Error("Aucune ressource physique disponible sur ce créneau.");
}

async function sendEmail({
  to,
  subject,
  html
}: {
  to: string | string[];
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
      to: Array.isArray(to) ? to : [to],
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

async function logNotification({
  bookingId,
  clientId,
  employeeId,
  channel,
  recipient,
  subject,
  message,
  status,
  provider,
  providerMessageId,
  failedReason
}: {
  bookingId: string;
  clientId?: string;
  employeeId?: string | null;
  channel: "email" | "internal";
  recipient: string;
  subject?: string;
  message: string;
  status: "sent" | "failed" | "pending";
  provider?: string;
  providerMessageId?: string;
  failedReason?: string;
}) {
  await supabaseServer.from("notifications").insert({
    booking_id: bookingId,
    client_id: clientId || null,
    employee_id: employeeId || null,
    channel,
    recipient,
    subject,
    message,
    status,
    provider,
    provider_message_id: providerMessageId,
    sent_at: status === "sent" ? new Date().toISOString() : null,
    failed_reason: failedReason || null
  });
}

export async function POST(request: NextRequest) {
  let payload: CreateBookingPayload;

  try {
    payload = await request.json();
  } catch {
    return jsonError("Payload JSON invalide.");
  }

  const serviceId = payload.serviceId?.trim();
  const date = payload.date?.trim();
  const time = payload.time?.trim();
  const firstName = payload.firstName?.trim();
  const lastName = payload.lastName?.trim();
  const phone = payload.phone?.trim();
  const email = payload.email?.trim().toLowerCase();
  const employeeId = payload.employeeId?.trim() || null;

  if (!serviceId || !date || !time || !firstName || !lastName || !phone || !email) {
    return jsonError("Champs obligatoires manquants.");
  }

  if (!payload.consent) {
    return jsonError("Le consentement RGPD est obligatoire.");
  }

  if (!isValidEmail(email)) {
    return jsonError("Adresse e-mail invalide.");
  }

  const { data: service, error: serviceError } = await supabaseServer
    .from("services")
    .select(
      "id,name,slug,short_description,duration_minutes,price_cents,service_type,capacity_max,payment_mode,deposit_cents,category:service_categories(id,name,slug)"
    )
    .eq("id", serviceId)
    .eq("is_active", true)
    .single();

  if (serviceError || !service) {
    return jsonError("Prestation introuvable ou inactive.", 404);
  }

  let assignedEmployeeId = employeeId;

  if (assignedEmployeeId) {
    const { data: validEmployeeService } = await supabaseServer
      .from("employee_services")
      .select("employee_id")
      .eq("service_id", serviceId)
      .eq("employee_id", assignedEmployeeId)
      .maybeSingle();

    if (!validEmployeeService) {
      return jsonError("L’employé sélectionné ne peut pas réaliser cette prestation.");
    }
  } else {
    const { data: firstEmployee } = await supabaseServer
      .from("employee_services")
      .select("employee_id")
      .eq("service_id", serviceId)
      .limit(1)
      .maybeSingle();

    assignedEmployeeId = firstEmployee?.employee_id || null;
  }

  let giftCard: any | null = null;
  let giftCardAppliedCents = 0;
  let paymentDueCents = service.price_cents || 0;
  const giftCardCode = normalizeGiftCardCode(payload.giftCardCode);

  if (giftCardCode && giftCardRedemptionEnabled()) {
    const { data: giftCardData, error: giftCardError } = await supabaseServer
      .from("gift_cards")
      .select("id,code,status,balance_cents,amount_cents,expires_at")
      .eq("code", giftCardCode)
      .maybeSingle();

    if (giftCardError) {
      return jsonError(giftCardError.message, 500);
    }

    if (!giftCardData) {
      return jsonError("Code carte cadeau introuvable.", 404);
    }

    if (giftCardData.status !== "active") {
      return jsonError("Cette carte cadeau n’est pas active.");
    }

    if (giftCardData.expires_at && new Date(giftCardData.expires_at).getTime() < Date.now()) {
      return jsonError("Cette carte cadeau a expiré.");
    }

    if (!giftCardData.balance_cents || giftCardData.balance_cents <= 0) {
      return jsonError("Cette carte cadeau n’a plus de solde disponible.");
    }

    giftCard = giftCardData;
    giftCardAppliedCents = Math.min(giftCard.balance_cents, service.price_cents || 0);
    paymentDueCents = Math.max((service.price_cents || 0) - giftCardAppliedCents, 0);
  }

  let paymentStatus: "unpaid" | "paid" | "partially_paid" = "unpaid";

  if (giftCardAppliedCents > 0 && paymentDueCents === 0) {
    paymentStatus = "paid";
  } else if (giftCardAppliedCents > 0 && paymentDueCents > 0) {
    paymentStatus = "partially_paid";
  }

  let clientId: string | null = null;

  const { data: existingClient } = await supabaseServer
    .from("clients")
    .select("id")
    .eq("email", email)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingClient?.id) {
    clientId = existingClient.id;

    await supabaseServer
      .from("clients")
      .update({
        first_name: firstName,
        last_name: lastName,
        phone,
        gdpr_consent: true,
        contraindications: service.category?.slug === "aqua-sports" ? payload.health || null : undefined
      })
      .eq("id", clientId);
  } else {
    const { data: createdClient, error: clientError } = await supabaseServer
      .from("clients")
      .insert({
        first_name: firstName,
        last_name: lastName,
        phone,
        email,
        gdpr_consent: true,
        contraindications: service.category?.slug === "aqua-sports" ? payload.health || null : null
      })
      .select("id")
      .single();

    if (clientError || !createdClient) {
      return jsonError(clientError?.message || "Impossible de créer la fiche client.", 500);
    }

    clientId = createdClient.id;
  }

  const clientComment =
    service.category?.slug === "aqua-sports"
      ? `Niveau : ${payload.level || "non renseigné"}. ${payload.comment || ""} ${
          payload.health ? `Santé : ${payload.health}` : ""
        }`.trim()
      : payload.comment || null;

  const bookingStartAt = toGuadeloupeIso(date, time);
  const bookingEndAt = new Date(
    new Date(bookingStartAt).getTime() + Number(service.duration_minutes || 0) * 60 * 1000
  ).toISOString();

  let assignedResource: any | null = null;

  try {
    assignedResource = await findAvailableResource({
      serviceId,
      startAt: bookingStartAt,
      endAt: bookingEndAt
    });
  } catch (resourceError: any) {
    return jsonError(resourceError?.message || "Aucune ressource disponible.", 409);
  }

  const { data: booking, error: bookingError } = await supabaseServer
    .from("bookings")
    .insert({
      client_id: clientId,
      service_id: serviceId,
      employee_id: assignedEmployeeId,
      start_at: bookingStartAt,
      resource_id: assignedResource?.id || null,
      status: "confirmed",
      client_comment: clientComment,
      gift_card_code: giftCard ? giftCard.code : null,
      gift_card_amount_cents: giftCardAppliedCents,
      payment_due_cents: paymentDueCents,
      payment_status: paymentStatus
    })
    .select(
      "id,booking_reference,management_token,start_at,end_at,status,duration_minutes,price_cents,payment_status,payment_amount_cents,payment_due_cents,gift_card_code,gift_card_amount_cents,google_calendar_event_id,google_calendar_calendar_id,resources(id,name,resource_type),clients(first_name,last_name,phone,email),services(name,duration_minutes,price_cents,payment_mode,deposit_cents),employees(id,public_display_name,role_title,google_calendar_id)"
    )
    .single();

  if (bookingError || !booking) {
    return jsonError(
      bookingError?.message || "Impossible de créer la réservation. Le créneau est peut-être déjà pris.",
      409
    );
  }

  if (giftCard && giftCardAppliedCents > 0) {
    await supabaseServer.from("gift_card_redemptions").insert({
      gift_card_id: giftCard.id,
      booking_id: booking.id,
      client_id: clientId,
      amount_cents: giftCardAppliedCents,
      note: `Utilisation lors de la réservation ${booking.booking_reference}`
    });

    const newBalance = Math.max((giftCard.balance_cents || 0) - giftCardAppliedCents, 0);

    await supabaseServer
      .from("gift_cards")
      .update({
        balance_cents: newBalance,
        status: newBalance === 0 ? "used" : "active"
      })
      .eq("id", giftCard.id);

    await supabaseServer.from("payments").insert({
      booking_id: booking.id,
      client_id: clientId,
      amount_cents: giftCardAppliedCents,
      currency: "eur",
      payment_provider: "gift_card",
      status: "paid",
      paid_at: new Date().toISOString(),
      provider_payload: {
        gift_card_id: giftCard.id,
        gift_card_code: giftCard.code,
        previous_balance_cents: giftCard.balance_cents,
        new_balance_cents: newBalance
      }
    });
  }

  const emailPayload = {
    bookingReference: booking.booking_reference,
    clientFirstName: firstName,
    clientLastName: lastName,
    clientPhone: phone,
    clientEmail: email,
    serviceName: service.name,
    employeeName: booking.employees?.public_display_name || null,
    dateLabel: formatDateLabel(date),
    timeLabel: time,
    durationMinutes: booking.duration_minutes || service.duration_minutes,
    priceLabel: formatPrice(booking.price_cents || service.price_cents),
    comment: clientComment,
    managementUrl: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/reservation/${booking.management_token}`,
    giftCardAppliedLabel: giftCardAppliedCents > 0 ? `-${formatPrice(giftCardAppliedCents)}` : null,
    remainingDueLabel: giftCardAppliedCents > 0 ? formatPrice(paymentDueCents) : null
  };

  let calendarResult:
    | {
        enabled: boolean;
        eventId: string | null;
        htmlLink: string | null;
        calendarId: string | null;
      }
    | null = null;

  try {
    calendarResult = await createGoogleCalendarEvent({
      calendarId: booking.employees?.google_calendar_id || null,
      summary: `${service.name} - ${firstName} ${lastName}`,
      description: buildCalendarEventDescription({
        bookingReference: booking.booking_reference,
        clientFirstName: firstName,
        clientLastName: lastName,
        clientPhone: phone,
        clientEmail: email,
        serviceName: service.name,
        priceLabel: formatPrice(booking.price_cents || service.price_cents),
        comment: clientComment
      }),
      startAt: booking.start_at,
      endAt: booking.end_at,
      timeZone: "America/Guadeloupe",
      location: "Hôtel Saint-Georges, Rue Gratien Parize, 97120 Saint-Claude"
    });

    if (calendarResult.enabled && calendarResult.eventId) {
      await supabaseServer
        .from("bookings")
        .update({
          google_calendar_event_id: calendarResult.eventId,
          google_calendar_calendar_id: calendarResult.calendarId
        })
        .eq("id", booking.id);

      await logNotification({
        bookingId: booking.id,
        clientId,
        employeeId: assignedEmployeeId,
        channel: "internal",
        recipient: calendarResult.calendarId || "google_calendar",
        subject: "Événement Google Calendar créé",
        message: calendarResult.htmlLink || calendarResult.eventId,
        status: "sent",
        provider: "google_calendar",
        providerMessageId: calendarResult.eventId
      });
    }
  } catch (calendarError: any) {
    await logNotification({
      bookingId: booking.id,
      clientId,
      employeeId: assignedEmployeeId,
      channel: "internal",
      recipient: "google_calendar",
      subject: "Erreur Google Calendar",
      message: calendarError?.message || "Erreur Google Calendar inconnue.",
      status: "failed",
      provider: "google_calendar",
      failedReason: calendarError?.message || "Erreur inconnue."
    });
  }

  const customerEmail = customerConfirmationEmail(emailPayload);
  const internalEmail = internalNotificationEmail(emailPayload);

  const customerResult = await sendEmail({
    to: email,
    subject: customerEmail.subject,
    html: customerEmail.html
  });

  await logNotification({
    bookingId: booking.id,
    clientId,
    employeeId: assignedEmployeeId,
    channel: "email",
    recipient: email,
    subject: customerEmail.subject,
    message: customerEmail.html,
    status: customerResult.error ? "failed" : "sent",
    provider: "resend",
    providerMessageId: customerResult.data?.id,
    failedReason: customerResult.error
  });

  const internalRecipient = process.env.INTERNAL_NOTIFICATION_EMAIL;

  let internalResult: Awaited<ReturnType<typeof sendEmail>> | null = null;

  if (internalRecipient) {
    internalResult = await sendEmail({
      to: internalRecipient,
      subject: internalEmail.subject,
      html: internalEmail.html
    });

    await logNotification({
      bookingId: booking.id,
      clientId,
      employeeId: assignedEmployeeId,
      channel: "internal",
      recipient: internalRecipient,
      subject: internalEmail.subject,
      message: internalEmail.html,
      status: internalResult.error ? "failed" : "sent",
      provider: "resend",
      providerMessageId: internalResult.data?.id,
      failedReason: internalResult.error
    });
  }

  let whatsappStatus: "disabled" | "sent" | "failed" = "disabled";

  try {
    const whatsappResult = await sendInternalWhatsAppBookingNotification(emailPayload);

    if (whatsappResult.enabled) {
      whatsappStatus = "sent";

      await logNotification({
        bookingId: booking.id,
        clientId,
        employeeId: assignedEmployeeId,
        channel: "whatsapp",
        recipient: whatsappResult.recipient,
        subject: "Notification WhatsApp interne",
        message: whatsappResult.message,
        status: "sent",
        provider: "whatsapp_cloud_api",
        providerMessageId: whatsappResult.providerMessageId
      });
    }
  } catch (whatsappError: any) {
    whatsappStatus = "failed";

    await logNotification({
      bookingId: booking.id,
      clientId,
      employeeId: assignedEmployeeId,
      channel: "whatsapp",
      recipient: process.env.WHATSAPP_INTERNAL_TO || "whatsapp_internal",
      subject: "Erreur WhatsApp interne",
      message: whatsappError?.message || "Erreur WhatsApp inconnue.",
      status: "failed",
      provider: "whatsapp_cloud_api",
      failedReason: whatsappError?.message || "Erreur inconnue."
    });
  }

  return NextResponse.json({
    ok: true,
    booking,
    notifications: {
      customerEmail: customerResult.error ? "failed" : "sent",
      internalEmail: !internalRecipient
        ? "disabled"
        : internalResult?.error
          ? "failed"
          : "sent",
      googleCalendar: !isGoogleCalendarEnabled()
        ? "disabled"
        : calendarResult?.eventId
          ? "created"
          : "failed",
      whatsappInternal: !isWhatsAppEnabled() ? "disabled" : whatsappStatus
    }
  });
}
