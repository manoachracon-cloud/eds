import { NextRequest, NextResponse } from "next/server";
import { authErrorResponse, requireStaff } from "@/lib/adminAuth";
import { supabaseServer } from "@/lib/supabaseServer";
import {
  buildCalendarEventDescription,
  createGoogleCalendarEvent,
  isGoogleCalendarEnabled
} from "@/lib/googleCalendar";

function jsonError(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

function isEnabled() {
  return process.env.ERROR_RECOVERY_ENABLED !== "false";
}

function maxRetries() {
  const value = Number(process.env.ERROR_RECOVERY_MAX_RETRIES || "3");
  return Number.isFinite(value) && value > 0 ? value : 3;
}

function formatPrice(cents: number) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0
  }).format((cents || 0) / 100);
}

function normalizePhone(value: string) {
  return value.replace(/[^\d]/g, "");
}

async function sendResendEmail({
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
    throw new Error("RESEND_API_KEY ou RESEND_FROM_EMAIL manquant.");
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
    throw new Error(data?.message || data?.error || "Erreur Resend.");
  }

  return {
    providerMessageId: data?.id,
    providerResponse: data
  };
}

async function sendWhatsAppText({
  to,
  message
}: {
  to: string;
  message: string;
}) {
  if (process.env.WHATSAPP_ENABLED !== "true") {
    throw new Error("WHATSAPP_ENABLED n’est pas activé.");
  }

  const version = process.env.WHATSAPP_GRAPH_API_VERSION || "v22.0";
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;

  if (!phoneNumberId || !accessToken) {
    throw new Error("WHATSAPP_PHONE_NUMBER_ID ou WHATSAPP_ACCESS_TOKEN manquant.");
  }

  const recipient = normalizePhone(to || process.env.WHATSAPP_INTERNAL_TO || "");

  if (!recipient) {
    throw new Error("Destinataire WhatsApp invalide.");
  }

  const response = await fetch(
    `https://graph.facebook.com/${version}/${encodeURIComponent(phoneNumberId)}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: recipient,
        type: "text",
        text: {
          preview_url: false,
          body: message
        }
      })
    }
  );

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(
      data?.error?.message ||
        data?.error?.error_user_msg ||
        data?.message ||
        "Erreur WhatsApp Business Cloud API."
    );
  }

  return {
    providerMessageId: data?.messages?.[0]?.id,
    providerResponse: data,
    recipient
  };
}

async function retryGoogleCalendar(notification: any) {
  if (!isGoogleCalendarEnabled()) {
    throw new Error("Google Calendar n’est pas activé.");
  }

  if (!notification.booking_id) {
    throw new Error("Cette notification Google Calendar n’est liée à aucune réservation.");
  }

  const { data: booking, error } = await supabaseServer
    .from("bookings")
    .select(
      "id,booking_reference,start_at,end_at,price_cents,client_comment,google_calendar_event_id,google_calendar_calendar_id,clients(first_name,last_name,phone,email),services(name),employees(public_display_name,google_calendar_id)"
    )
    .eq("id", notification.booking_id)
    .single();

  if (error || !booking) {
    throw new Error(error?.message || "Réservation introuvable.");
  }

  const calendarId =
    booking.employees?.google_calendar_id ||
    booking.google_calendar_calendar_id ||
    process.env.GOOGLE_CALENDAR_ID ||
    null;

  const result = await createGoogleCalendarEvent({
    calendarId,
    summary: `${booking.services?.name || "Rendez-vous"} — ${booking.clients?.first_name || ""} ${booking.clients?.last_name || ""}`,
    description: buildCalendarEventDescription({
      bookingReference: booking.booking_reference,
      clientFirstName: booking.clients?.first_name || "",
      clientLastName: booking.clients?.last_name || "",
      clientPhone: booking.clients?.phone || "",
      clientEmail: booking.clients?.email || "",
      serviceName: booking.services?.name || "Prestation",
      priceLabel: formatPrice(booking.price_cents || 0),
      comment: booking.client_comment || null
    }),
    startAt: booking.start_at,
    endAt: booking.end_at
  });

  if (result.enabled && result.eventId) {
    await supabaseServer
      .from("bookings")
      .update({
        google_calendar_event_id: result.eventId,
        google_calendar_calendar_id: result.calendarId,
        google_calendar_html_link: result.htmlLink
      })
      .eq("id", booking.id);
  }

  return result;
}

async function createRetryLog({
  original,
  status,
  providerMessageId,
  message,
  failedReason,
  provider,
  metadata
}: {
  original: any;
  status: "sent" | "failed";
  providerMessageId?: string | null;
  message?: string;
  failedReason?: string | null;
  provider?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const { data, error } = await supabaseServer
    .from("notifications")
    .insert({
      booking_id: original.booking_id || null,
      client_id: original.client_id || null,
      employee_id: original.employee_id || null,
      channel: original.channel,
      recipient: original.recipient,
      subject: original.subject || `Relance ${original.channel}`,
      message: message || original.message || "Relance notification",
      status,
      provider: provider || original.provider,
      provider_message_id: providerMessageId || null,
      sent_at: status === "sent" ? new Date().toISOString() : null,
      failed_reason: failedReason || null,
      retry_parent_id: original.id,
      retry_count: 0,
      severity: status === "sent" ? "success" : "error",
      event_type: "retry",
      metadata: {
        original_notification_id: original.id,
        original_provider: original.provider,
        ...metadata
      }
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function POST(request: NextRequest) {
  try {
    await requireStaff(request, ["super_admin", "admin"]);
  } catch (error) {
    return authErrorResponse(error);
  }

  if (!isEnabled()) {
    return jsonError("Le module de relance n’est pas activé.", 503);
  }

  const body = await request.json().catch(() => null);
  const notificationId = body?.notificationId;

  if (!notificationId) {
    return jsonError("notificationId est obligatoire.");
  }

  const { data: notification, error } = await supabaseServer
    .from("notifications")
    .select("*")
    .eq("id", notificationId)
    .single();

  if (error || !notification) {
    return jsonError(error?.message || "Notification introuvable.", 404);
  }

  if (notification.retry_count >= maxRetries()) {
    return jsonError(`Nombre maximum de relances atteint (${maxRetries()}).`, 409);
  }

  if (notification.can_retry === false) {
    return jsonError("Cette notification n’est pas relançable.", 409);
  }

  let retryStatus: "sent" | "failed" = "sent";
  let providerMessageId: string | null = null;
  let failedReason: string | null = null;
  let retryMessage = notification.message;
  let provider = notification.provider;
  let metadata: Record<string, unknown> = {};

  try {
    if (notification.channel === "email" || notification.channel === "internal") {
      const result = await sendResendEmail({
        to: notification.recipient,
        subject: notification.subject || "Notification Esthetic Diamonds & Spa",
        html: notification.message
      });

      providerMessageId = result.providerMessageId || null;
      provider = "resend";
      metadata = { provider_response: result.providerResponse };
    } else if (notification.channel === "whatsapp") {
      const result = await sendWhatsAppText({
        to: notification.recipient,
        message: notification.message
      });

      providerMessageId = result.providerMessageId || null;
      provider = "whatsapp_cloud_api";
      retryMessage = notification.message;
      metadata = {
        provider_response: result.providerResponse,
        recipient: result.recipient
      };
    } else if (notification.channel === "google_calendar" || notification.provider === "google_calendar") {
      const result = await retryGoogleCalendar(notification);

      providerMessageId = result.eventId || null;
      provider = "google_calendar";
      retryMessage = `Événement Google Calendar recréé : ${result.htmlLink || result.eventId || "sans lien"}`;
      metadata = {
        calendar_id: result.calendarId,
        html_link: result.htmlLink
      };
    } else {
      throw new Error(`Canal non relançable en V1.17 : ${notification.channel}`);
    }

    retryStatus = "sent";
  } catch (retryError: any) {
    retryStatus = "failed";
    failedReason = retryError?.message || "Erreur de relance inconnue.";
  }

  const retryLog = await createRetryLog({
    original: notification,
    status: retryStatus,
    providerMessageId,
    message: retryMessage,
    failedReason,
    provider,
    metadata
  });

  await supabaseServer
    .from("notifications")
    .update({
      retry_count: (notification.retry_count || 0) + 1,
      last_retry_at: new Date().toISOString(),
      is_read: retryStatus === "sent" ? true : notification.is_read,
      resolved_at: retryStatus === "sent" ? new Date().toISOString() : notification.resolved_at,
      resolution_note:
        retryStatus === "sent"
          ? `Relance réussie via notification ${retryLog.id}`
          : notification.resolution_note
    })
    .eq("id", notification.id);

  return NextResponse.json({
    ok: retryStatus === "sent",
    status: retryStatus,
    retryNotificationId: retryLog.id,
    failedReason
  });
}
