import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { supabaseServer } from "@/lib/supabaseServer";
import { getStripe } from "@/lib/stripeServer";
import { customerPaymentSuccessEmail } from "@/lib/paymentTemplates";
import {
  giftCardBuyerConfirmationEmail,
  giftCardRecipientEmail
} from "@/lib/giftCardTemplates";

export const runtime = "nodejs";

function formatPrice(cents: number, currency = "eur") {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: currency.toUpperCase(),
    maximumFractionDigits: 0
  }).format(cents / 100);
}

function formatGiftExpiry(value: string | null) {
  if (!value) return null;

  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
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

async function handleGiftCardCheckoutCompleted(session: Stripe.Checkout.Session) {
  const giftCardId = session.metadata?.gift_card_id;

  if (!giftCardId) return;

  const paymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id || null;

  const { data: giftCard, error } = await supabaseServer
    .from("gift_cards")
    .update({
      status: "active",
      paid_at: new Date().toISOString(),
      stripe_payment_intent_id: paymentIntentId
    })
    .eq("id", giftCardId)
    .select(
      "id,code,buyer_name,buyer_email,recipient_name,recipient_email,message,amount_cents,balance_cents,currency,expires_at"
    )
    .single();

  if (error || !giftCard) {
    throw new Error(error?.message || "Carte cadeau introuvable.");
  }

  const payload = {
    code: giftCard.code,
    amountLabel: formatPrice(giftCard.amount_cents, giftCard.currency || "eur"),
    buyerName: giftCard.buyer_name,
    buyerEmail: giftCard.buyer_email,
    recipientName: giftCard.recipient_name,
    recipientEmail: giftCard.recipient_email,
    message: giftCard.message,
    expiresAtLabel: formatGiftExpiry(giftCard.expires_at)
  };

  const buyerEmail = giftCardBuyerConfirmationEmail(payload);
  const buyerResult = await sendEmail({
    to: giftCard.buyer_email,
    subject: buyerEmail.subject,
    html: buyerEmail.html
  });

  await supabaseServer.from("notifications").insert({
    channel: "email",
    recipient: giftCard.buyer_email,
    subject: buyerEmail.subject,
    message: buyerEmail.html,
    status: buyerResult.error ? "failed" : "sent",
    provider: "resend",
    provider_message_id: buyerResult.data?.id,
    sent_at: buyerResult.error ? null : new Date().toISOString(),
    failed_reason: buyerResult.error || null
  });

  if (giftCard.recipient_email) {
    const recipientEmail = giftCardRecipientEmail(payload);
    const recipientResult = await sendEmail({
      to: giftCard.recipient_email,
      subject: recipientEmail.subject,
      html: recipientEmail.html
    });

    await supabaseServer.from("notifications").insert({
      channel: "email",
      recipient: giftCard.recipient_email,
      subject: recipientEmail.subject,
      message: recipientEmail.html,
      status: recipientResult.error ? "failed" : "sent",
      provider: "resend",
      provider_message_id: recipientResult.data?.id,
      sent_at: recipientResult.error ? null : new Date().toISOString(),
      failed_reason: recipientResult.error || null
    });
  }

  await supabaseServer.from("notifications").insert({
    channel: "internal",
    recipient: "stripe",
    subject: "Carte cadeau Stripe confirmée",
    message: `Carte cadeau ${giftCard.code} payée via Checkout session ${session.id}.`,
    status: "sent",
    provider: "stripe",
    provider_message_id: session.id,
    sent_at: new Date().toISOString()
  });
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  if (session.metadata?.type === "gift_card") {
    await handleGiftCardCheckoutCompleted(session);
    return;
  }

  const bookingId = session.metadata?.booking_id;

  if (!bookingId) {
    return;
  }

  const amount = session.amount_total || 0;
  const currency = session.currency || "eur";
  const paymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id || null;

  await supabaseServer
    .from("payments")
    .update({
      status: "paid",
      payment_intent_id: paymentIntentId,
      paid_at: new Date().toISOString(),
      provider_payload: session
    })
    .eq("checkout_session_id", session.id);

  await supabaseServer
    .from("bookings")
    .update({
      payment_status: "paid",
      payment_amount_cents: amount,
      stripe_checkout_session_id: session.id,
      stripe_payment_intent_id: paymentIntentId
    })
    .eq("id", bookingId);

  const { data: booking } = await supabaseServer
    .from("bookings")
    .select(
      "id,booking_reference,clients(id,first_name,last_name,email,phone),services(name)"
    )
    .eq("id", bookingId)
    .single();

  if (booking?.clients?.email) {
    const email = customerPaymentSuccessEmail({
      clientFirstName: booking.clients.first_name,
      bookingReference: booking.booking_reference,
      serviceName: booking.services?.name || "Votre prestation",
      amountLabel: formatPrice(amount, currency),
      paymentStatus: "paid"
    });

    const result = await sendEmail({
      to: booking.clients.email,
      subject: email.subject,
      html: email.html
    });

    await supabaseServer.from("notifications").insert({
      booking_id: booking.id,
      client_id: booking.clients.id,
      channel: "email",
      recipient: booking.clients.email,
      subject: email.subject,
      message: email.html,
      status: result.error ? "failed" : "sent",
      provider: "resend",
      provider_message_id: result.data?.id,
      sent_at: result.error ? null : new Date().toISOString(),
      failed_reason: result.error || null
    });
  }

  await supabaseServer.from("notifications").insert({
    booking_id: bookingId,
    channel: "internal",
    recipient: "stripe",
    subject: "Paiement Stripe confirmé",
    message: `Checkout session ${session.id} payée.`,
    status: "sent",
    provider: "stripe",
    provider_message_id: session.id,
    sent_at: new Date().toISOString()
  });
}

async function handlePaymentFailed(session: Stripe.Checkout.Session) {
  if (session.metadata?.type === "gift_card" && session.metadata?.gift_card_id) {
    await supabaseServer
      .from("gift_cards")
      .update({ status: "cancelled" })
      .eq("id", session.metadata.gift_card_id);
    return;
  }

  const bookingId = session.metadata?.booking_id;

  if (!bookingId) return;

  await supabaseServer
    .from("payments")
    .update({
      status: "failed",
      provider_payload: session
    })
    .eq("checkout_session_id", session.id);

  await supabaseServer
    .from("bookings")
    .update({
      payment_status: "failed"
    })
    .eq("id", bookingId);
}

export async function POST(request: NextRequest) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    return NextResponse.json(
      { ok: false, error: "STRIPE_WEBHOOK_SECRET est manquant." },
      { status: 500 }
    );
  }

  const stripe = getStripe();
  const rawBody = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ ok: false, error: "Signature Stripe manquante." }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: `Webhook signature invalide : ${error.message}` },
      { status: 400 }
    );
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;

      case "checkout.session.expired":
      case "checkout.session.async_payment_failed":
        await handlePaymentFailed(event.data.object as Stripe.Checkout.Session);
        break;

      default:
        break;
    }

    return NextResponse.json({ received: true });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message || "Erreur webhook Stripe." },
      { status: 500 }
    );
  }
}
