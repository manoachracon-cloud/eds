import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { appUrl, getStripe, isStripeEnabled, stripeCurrency } from "@/lib/stripeServer";

function jsonError(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

function amountToPay(booking: any) {
  const service = booking.services;
  const mode = service?.payment_mode || "pay_on_site";
  const remainingDue = Math.max(Number(booking.payment_due_cents ?? booking.price_cents ?? service?.price_cents ?? 0), 0);

  if (mode === "pay_on_site") return 0;
  if (mode === "deposit_required") return Math.min(service?.deposit_cents || 0, remainingDue);
  if (mode === "full_payment_required") return remainingDue;

  return 0;
}

export async function POST(request: NextRequest) {
  if (!isStripeEnabled()) {
    return jsonError("Stripe n’est pas activé.", 503);
  }

  const body = await request.json().catch(() => null);
  const token = body?.token;

  if (!token) {
    return jsonError("Token de réservation manquant.");
  }

  const { data: booking, error } = await supabaseServer
    .from("bookings")
    .select(
      "id,booking_reference,management_token,status,payment_status,payment_amount_cents,payment_due_cents,price_cents,clients(id,first_name,last_name,email,phone),services(id,name,price_cents,payment_mode,deposit_cents)"
    )
    .eq("management_token", token)
    .single();

  if (error || !booking) {
    return jsonError("Réservation introuvable.", 404);
  }

  if (booking.status !== "confirmed") {
    return jsonError("Cette réservation n’est plus éligible au paiement.", 409);
  }

  if (booking.payment_status === "paid" || Number(booking.payment_due_cents || 0) === 0) {
    return NextResponse.json({
      ok: true,
      alreadyPaid: true,
      redirectUrl: `${appUrl()}/reservation/${booking.management_token}?payment=already_paid`
    });
  }

  const amountCents = amountToPay(booking);

  if (amountCents <= 0) {
    return jsonError("Cette prestation est configurée en paiement sur place.", 409);
  }

  const stripe = getStripe();

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: booking.clients?.email || undefined,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: stripeCurrency(),
          unit_amount: amountCents,
          product_data: {
            name: booking.services?.name || "Réservation Esthetic Diamonds & Spa",
            description: `Réservation ${booking.booking_reference}`
          }
        }
      }
    ],
    success_url: `${appUrl()}/reservation/${booking.management_token}?payment=success`,
    cancel_url: `${appUrl()}/reservation/${booking.management_token}?payment=cancelled`,
    metadata: {
      booking_id: booking.id,
      booking_reference: booking.booking_reference,
      client_id: booking.clients?.id || "",
      service_id: booking.services?.id || ""
    },
    payment_intent_data: {
      metadata: {
        booking_id: booking.id,
        booking_reference: booking.booking_reference
      }
    }
  });

  await supabaseServer.from("payments").insert({
    booking_id: booking.id,
    client_id: booking.clients?.id || null,
    amount_cents: amountCents,
    currency: stripeCurrency(),
    payment_provider: "stripe",
    checkout_session_id: session.id,
    status: "pending",
    provider_payload: session
  });

  await supabaseServer
    .from("bookings")
    .update({
      payment_status: "pending",
      payment_amount_cents: amountCents,
      stripe_checkout_session_id: session.id
    })
    .eq("id", booking.id);

  return NextResponse.json({
    ok: true,
    checkoutUrl: session.url
  });
}
