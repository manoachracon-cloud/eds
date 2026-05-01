import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { customerReminderEmail } from "@/lib/reminderTemplates";

type ReminderType = "24h" | "2h";

type BookingRow = {
  id: string;
  booking_reference: string;
  management_token: string;
  start_at: string;
  end_at: string;
  duration_minutes: number;
  status: string;
  clients: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    phone: string;
  } | null;
  services: {
    name: string;
    duration_minutes: number;
  } | null;
};

function isEnabled() {
  return process.env.REMINDERS_ENABLED !== "false";
}

function windowMinutes() {
  const value = Number(process.env.REMINDER_WINDOW_MINUTES || "35");
  return Number.isFinite(value) && value > 0 ? value : 35;
}

function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60 * 1000);
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

function reminderSubject(type: ReminderType) {
  return type === "24h" ? "Rappel client 24h" : "Rappel client 2h";
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

async function alreadySent(bookingId: string, type: ReminderType) {
  const { data, error } = await supabaseServer
    .from("notifications")
    .select("id")
    .eq("booking_id", bookingId)
    .eq("reminder_type", type)
    .in("status", ["sent", "pending"])
    .limit(1)
    .maybeSingle();

  if (error && error.code !== "PGRST116") {
    throw error;
  }

  return Boolean(data?.id);
}

async function logReminder({
  booking,
  type,
  html,
  subject,
  status,
  providerMessageId,
  failedReason
}: {
  booking: BookingRow;
  type: ReminderType;
  html: string;
  subject: string;
  status: "sent" | "failed";
  providerMessageId?: string;
  failedReason?: string;
}) {
  await supabaseServer.from("notifications").insert({
    booking_id: booking.id,
    client_id: booking.clients?.id || null,
    channel: "email",
    recipient: booking.clients?.email || "unknown",
    subject,
    message: html,
    status,
    provider: "resend",
    provider_message_id: providerMessageId,
    sent_at: status === "sent" ? new Date().toISOString() : null,
    failed_reason: failedReason || null,
    reminder_type: type
  });
}

async function processReminderType(type: ReminderType) {
  const now = new Date();
  const targetMinutes = type === "24h" ? 24 * 60 : 2 * 60;
  const halfWindow = Math.floor(windowMinutes() / 2);

  const from = addMinutes(now, targetMinutes - halfWindow);
  const to = addMinutes(now, targetMinutes + halfWindow);

  const { data, error } = await supabaseServer
    .from("bookings")
    .select(
      "id,booking_reference,management_token,start_at,end_at,duration_minutes,status,clients(id,first_name,last_name,email,phone),services(name,duration_minutes)"
    )
    .eq("status", "confirmed")
    .gte("start_at", from.toISOString())
    .lt("start_at", to.toISOString())
    .order("start_at", { ascending: true })
    .limit(100);

  if (error) {
    throw error;
  }

  const results = {
    type,
    window: {
      from: from.toISOString(),
      to: to.toISOString()
    },
    found: data?.length || 0,
    sent: 0,
    skipped: 0,
    failed: 0,
    errors: [] as string[]
  };

  for (const booking of (data || []) as unknown as BookingRow[]) {
    try {
      if (!booking.clients?.email) {
        results.skipped += 1;
        continue;
      }

      if (await alreadySent(booking.id, type)) {
        results.skipped += 1;
        continue;
      }

      const email = customerReminderEmail({
        clientFirstName: booking.clients.first_name,
        serviceName: booking.services?.name || "Votre prestation",
        dateLabel: formatDateLabel(booking.start_at),
        timeLabel: formatTimeLabel(booking.start_at),
        durationMinutes: booking.duration_minutes || booking.services?.duration_minutes || 0,
        bookingReference: booking.booking_reference,
        reminderType: type,
        managementUrl: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/reservation/${booking.management_token}`
      });

      const sendResult = await sendEmail({
        to: booking.clients.email,
        subject: email.subject,
        html: email.html
      });

      await logReminder({
        booking,
        type,
        html: email.html,
        subject: reminderSubject(type),
        status: sendResult.error ? "failed" : "sent",
        providerMessageId: sendResult.data?.id,
        failedReason: sendResult.error
      });

      if (sendResult.error) {
        results.failed += 1;
        results.errors.push(`${booking.booking_reference}: ${sendResult.error}`);
      } else {
        results.sent += 1;
      }
    } catch (error: any) {
      results.failed += 1;
      results.errors.push(`${booking.booking_reference}: ${error?.message || "Erreur inconnue."}`);
    }
  }

  return results;
}

function isAuthorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET;

  if (!secret) {
    return true;
  }

  const authorization = request.headers.get("authorization");

  return authorization === `Bearer ${secret}`;
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  if (!isEnabled()) {
    return NextResponse.json({
      ok: true,
      enabled: false,
      message: "REMINDERS_ENABLED=false"
    });
  }

  try {
    const [r24h, r2h] = await Promise.all([
      processReminderType("24h"),
      processReminderType("2h")
    ]);

    return NextResponse.json({
      ok: true,
      enabled: true,
      results: [r24h, r2h]
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        error: error?.message || "Erreur cron rappels."
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
