import { NextRequest, NextResponse } from "next/server";
import { authErrorResponse, requireStaff } from "@/lib/adminAuth";
import { supabaseServer } from "@/lib/supabaseServer";
import { deleteGoogleCalendarEvent, isGoogleCalendarEnabled } from "@/lib/googleCalendar";

type Payload = {
  bookingId?: string;
  status?: "pending" | "confirmed" | "cancelled" | "done" | "no_show" | "rescheduled";
};

function jsonError(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

export async function POST(request: NextRequest) {
  try {
    await requireStaff(request, ["super_admin", "admin", "reception", "employee_esthetic", "coach_aquasport"]);
  } catch (error) {
    return authErrorResponse(error);
  }

  let payload: Payload;

  try {
    payload = await request.json();
  } catch {
    return jsonError("Payload JSON invalide.");
  }

  if (!payload.bookingId || !payload.status) {
    return jsonError("bookingId et status sont obligatoires.");
  }

  const allowed = ["pending", "confirmed", "cancelled", "done", "no_show", "rescheduled"];

  if (!allowed.includes(payload.status)) {
    return jsonError("Statut invalide.");
  }

  const { data: booking, error: bookingError } = await supabaseServer
    .from("bookings")
    .select("id,google_calendar_event_id,google_calendar_calendar_id,client_id,employee_id")
    .eq("id", payload.bookingId)
    .single();

  if (bookingError || !booking) {
    return jsonError("Réservation introuvable.", 404);
  }

  let calendarStatus: "disabled" | "not_needed" | "deleted" | "failed" = "not_needed";

  if (payload.status === "cancelled" && booking.google_calendar_event_id) {
    if (!isGoogleCalendarEnabled()) {
      calendarStatus = "disabled";
    } else {
      try {
        await deleteGoogleCalendarEvent({
          calendarId: booking.google_calendar_calendar_id,
          eventId: booking.google_calendar_event_id
        });

        calendarStatus = "deleted";

        await supabaseServer.from("notifications").insert({
          booking_id: booking.id,
          client_id: booking.client_id,
          employee_id: booking.employee_id,
          channel: "google_calendar",
          recipient: booking.google_calendar_calendar_id || "google_calendar",
          subject: "Événement Google Calendar supprimé",
          message: booking.google_calendar_event_id,
          status: "sent",
          provider: "google_calendar",
          provider_message_id: booking.google_calendar_event_id,
          sent_at: new Date().toISOString()
        });
      } catch (error: any) {
        calendarStatus = "failed";

        await supabaseServer.from("notifications").insert({
          booking_id: booking.id,
          client_id: booking.client_id,
          employee_id: booking.employee_id,
          channel: "google_calendar",
          recipient: booking.google_calendar_calendar_id || "google_calendar",
          subject: "Erreur suppression Google Calendar",
          message: error?.message || "Erreur Google Calendar inconnue.",
          status: "failed",
          provider: "google_calendar",
          failed_reason: error?.message || "Erreur inconnue."
        });
      }
    }
  }

  const updatePayload: any = {
    status: payload.status
  };

  if (payload.status === "cancelled") {
    updatePayload.cancelled_at = new Date().toISOString();
  }

  const { data: updatedBooking, error: updateError } = await supabaseServer
    .from("bookings")
    .update(updatePayload)
    .eq("id", payload.bookingId)
    .select("id,status")
    .single();

  if (updateError) {
    return jsonError(updateError.message, 500);
  }

  return NextResponse.json({
    ok: true,
    booking: updatedBooking,
    calendarStatus
  });
}
