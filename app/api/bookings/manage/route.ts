import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { deleteGoogleCalendarEvent, isGoogleCalendarEnabled } from "@/lib/googleCalendar";
import {
  customerCancellationEmail,
  customerModificationRequestEmail,
  internalCancellationEmail,
  internalModificationRequestEmail
} from "@/lib/bookingManagementTemplates";

type ManageAction = "cancel" | "request_modification";

function jsonError(message: string, status = 400, extra: Record<string, unknown> = {}) {
  return NextResponse.json({ ok: false, error: message, ...extra }, { status });
}

function cancellationMinHours() {
  const envValue = Number(process.env.CLIENT_CANCELLATION_MIN_HOURS || "24");
  return Number.isFinite(envValue) && envValue >= 0 ? envValue : 24;
}

function managementBaseUrl() {
  return process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
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

function canCancel(startAt: string) {
  const minMs = cancellationMinHours() * 60 * 60 * 1000;
  return new Date(startAt).getTime() - Date.now() >= minMs;
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

async function getBookingByToken(token: string) {
  const { data, error } = await supabaseServer
    .from("bookings")
    .select(
      "id,booking_reference,management_token,start_at,end_at,status,duration_minutes,price_cents,payment_status,payment_amount_cents,payment_due_cents,gift_card_code,gift_card_amount_cents,client_comment,google_calendar_event_id,google_calendar_calendar_id,clients(id,first_name,last_name,email,phone),services(id,name,duration_minutes,price_cents,payment_mode,deposit_cents),employees(id,public_display_name,role_title)"
    )
    .eq("management_token", token)
    .single();

  if (error || !data) {
    return null;
  }

  return data as any;
}

function publicBookingPayload(booking: any) {
  return {
    id: booking.id,
    bookingReference: booking.booking_reference,
    status: booking.status,
    startAt: booking.start_at,
    endAt: booking.end_at,
    durationMinutes: booking.duration_minutes,
    priceCents: booking.price_cents,
    paymentStatus: booking.payment_status || "unpaid",
    paymentAmountCents: booking.payment_amount_cents || 0,
    paymentDueCents: booking.payment_due_cents || 0,
    giftCardCode: booking.gift_card_code || null,
    giftCardAmountCents: booking.gift_card_amount_cents || 0,
    paymentMode: booking.services?.payment_mode || "pay_on_site",
    paymentRequired:
      booking.services?.payment_mode === "deposit_required" ||
      booking.services?.payment_mode === "full_payment_required",
    paymentIsPaid: booking.payment_status === "paid",
    canCancel: booking.status === "confirmed" && canCancel(booking.start_at),
    cancellationMinHours: cancellationMinHours(),
    managementUrl: `${managementBaseUrl()}/reservation/${booking.management_token}`,
    client: {
      firstName: booking.clients?.first_name,
      lastName: booking.clients?.last_name,
      email: booking.clients?.email,
      phone: booking.clients?.phone
    },
    service: {
      name: booking.services?.name,
      durationMinutes: booking.services?.duration_minutes
    },
    employee: booking.employees
      ? {
          name: booking.employees.public_display_name,
          role: booking.employees.role_title
        }
      : null
  };
}

function emailPayload(booking: any, extra: Record<string, unknown> = {}) {
  return {
    bookingReference: booking.booking_reference,
    clientFirstName: booking.clients?.first_name || "",
    clientLastName: booking.clients?.last_name || "",
    clientEmail: booking.clients?.email || "",
    clientPhone: booking.clients?.phone || "",
    serviceName: booking.services?.name || "Votre prestation",
    dateLabel: formatDateLabel(booking.start_at),
    timeLabel: formatTimeLabel(booking.start_at),
    employeeName: booking.employees?.public_display_name || null,
    ...extra
  };
}

async function logNotification({
  booking,
  recipient,
  subject,
  html,
  status,
  providerMessageId,
  failedReason
}: {
  booking: any;
  recipient: string;
  subject: string;
  html: string;
  status: "sent" | "failed";
  providerMessageId?: string;
  failedReason?: string;
}) {
  await supabaseServer.from("notifications").insert({
    booking_id: booking.id,
    client_id: booking.clients?.id || null,
    employee_id: booking.employees?.id || null,
    channel: "email",
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

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");

  if (!token) {
    return jsonError("Token manquant.");
  }

  const booking = await getBookingByToken(token);

  if (!booking) {
    return jsonError("Réservation introuvable.", 404);
  }

  return NextResponse.json({
    ok: true,
    booking: publicBookingPayload(booking)
  });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);

  if (!body?.token || !body?.action) {
    return jsonError("Token et action obligatoires.");
  }

  const action = body.action as ManageAction;
  const booking = await getBookingByToken(body.token);

  if (!booking) {
    return jsonError("Réservation introuvable.", 404);
  }

  if (booking.status !== "confirmed") {
    return jsonError("Cette réservation n’est plus modifiable.", 409, {
      booking: publicBookingPayload(booking)
    });
  }

  if (action === "cancel") {
    if (!canCancel(booking.start_at)) {
      return jsonError(
        `L’annulation en ligne n’est plus disponible à moins de ${cancellationMinHours()}h du rendez-vous. Merci de contacter l’équipe.`,
        409,
        {
          reason: "cancellation_window_expired",
          booking: publicBookingPayload(booking)
        }
      );
    }

    if (booking.google_calendar_event_id && isGoogleCalendarEnabled()) {
      try {
        await deleteGoogleCalendarEvent({
          calendarId: booking.google_calendar_calendar_id,
          eventId: booking.google_calendar_event_id
        });
      } catch (error: any) {
        await supabaseServer.from("notifications").insert({
          booking_id: booking.id,
          client_id: booking.clients?.id || null,
          employee_id: booking.employees?.id || null,
          channel: "google_calendar",
          recipient: booking.google_calendar_calendar_id || "google_calendar",
          subject: "Erreur suppression Google Calendar après annulation client",
          message: error?.message || "Erreur inconnue",
          status: "failed",
          provider: "google_calendar",
          failed_reason: error?.message || "Erreur inconnue."
        });
      }
    }

    const { data: updatedBooking, error } = await supabaseServer
      .from("bookings")
      .update({
        status: "cancelled",
        cancelled_at: new Date().toISOString(),
        cancellation_reason: body.reason || "Annulation client depuis lien de gestion"
      })
      .eq("id", booking.id)
      .select("id,status")
      .single();

    if (error) {
      return jsonError(error.message, 500);
    }

    const customerEmail = customerCancellationEmail(emailPayload(booking, { reason: body.reason }));
    const internalEmail = internalCancellationEmail(emailPayload(booking, { reason: body.reason }));

    const customerResult = await sendEmail({
      to: booking.clients.email,
      subject: customerEmail.subject,
      html: customerEmail.html
    });

    await logNotification({
      booking,
      recipient: booking.clients.email,
      subject: customerEmail.subject,
      html: customerEmail.html,
      status: customerResult.error ? "failed" : "sent",
      providerMessageId: customerResult.data?.id,
      failedReason: customerResult.error
    });

    const internalRecipient = process.env.INTERNAL_NOTIFICATION_EMAIL;

    if (internalRecipient) {
      const internalResult = await sendEmail({
        to: internalRecipient,
        subject: internalEmail.subject,
        html: internalEmail.html
      });

      await logNotification({
        booking,
        recipient: internalRecipient,
        subject: internalEmail.subject,
        html: internalEmail.html,
        status: internalResult.error ? "failed" : "sent",
        providerMessageId: internalResult.data?.id,
        failedReason: internalResult.error
      });
    }

    return NextResponse.json({
      ok: true,
      action: "cancelled",
      booking: {
        ...publicBookingPayload(booking),
        status: updatedBooking.status,
        canCancel: false
      }
    });
  }

  if (action === "request_modification") {
    const requestedDate = body.requestedDate || null;
    const requestedTime = body.requestedTime || null;
    const message = body.message || null;

    const { data: requestRow, error } = await supabaseServer
      .from("booking_change_requests")
      .insert({
        booking_id: booking.id,
        client_id: booking.clients?.id || null,
        requested_date: requestedDate,
        requested_time: requestedTime,
        message,
        status: "pending"
      })
      .select("id")
      .single();

    if (error) {
      return jsonError(error.message, 500);
    }

    const payload = emailPayload(booking, {
      requestedDate,
      requestedTime,
      message
    });

    const customerEmail = customerModificationRequestEmail(payload);
    const internalEmail = internalModificationRequestEmail(payload);

    const customerResult = await sendEmail({
      to: booking.clients.email,
      subject: customerEmail.subject,
      html: customerEmail.html
    });

    await logNotification({
      booking,
      recipient: booking.clients.email,
      subject: customerEmail.subject,
      html: customerEmail.html,
      status: customerResult.error ? "failed" : "sent",
      providerMessageId: customerResult.data?.id,
      failedReason: customerResult.error
    });

    const internalRecipient = process.env.INTERNAL_NOTIFICATION_EMAIL;

    if (internalRecipient) {
      const internalResult = await sendEmail({
        to: internalRecipient,
        subject: internalEmail.subject,
        html: internalEmail.html
      });

      await logNotification({
        booking,
        recipient: internalRecipient,
        subject: internalEmail.subject,
        html: internalEmail.html,
        status: internalResult.error ? "failed" : "sent",
        providerMessageId: internalResult.data?.id,
        failedReason: internalResult.error
      });
    }

    return NextResponse.json({
      ok: true,
      action: "modification_requested",
      requestId: requestRow.id,
      booking: publicBookingPayload(booking)
    });
  }

  return jsonError("Action inconnue.");
}
