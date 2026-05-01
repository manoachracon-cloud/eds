import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { appUrl, getStripe, isStripeEnabled, stripeCurrency } from "@/lib/stripeServer";

function jsonError(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

function isValidEmail(email: string) {
  return /.+@.+\..+/.test(email);
}

function giftCardExpiryDate() {
  const months = Number(process.env.GIFT_CARD_DEFAULT_EXPIRY_MONTHS || "12");
  const date = new Date();
  date.setMonth(date.getMonth() + (Number.isFinite(months) && months > 0 ? months : 12));
  return date.toISOString();
}

export async function POST(request: NextRequest) {
  if (process.env.GIFT_CARDS_ENABLED === "false") {
    return jsonError("Les cartes cadeaux ne sont pas activées.", 503);
  }

  if (!isStripeEnabled()) {
    return jsonError("Stripe n’est pas activé.", 503);
  }

  const body = await request.json().catch(() => null);

  const amountCents = Number(body?.amountCents);
  const buyerName = String(body?.buyerName || "").trim();
  const buyerEmail = String(body?.buyerEmail || "").trim().toLowerCase();
  const recipientName = String(body?.recipientName || "").trim();
  const recipientEmail = String(body?.recipientEmail || "").trim().toLowerCase();
  const message = String(body?.message || "").trim();

  if (!amountCents || amountCents < 1000) {
    return jsonError("Le montant minimum de la carte cadeau est de 10 €.");
  }

  if (amountCents > 100000) {
    return jsonError("Le montant maximum de la carte cadeau est de 1 000 €.");
  }

  if (!buyerName || !buyerEmail || !isValidEmail(buyerEmail)) {
    return jsonError("Les informations acheteur sont incomplètes.");
  }

  if (recipientEmail && !isValidEmail(recipientEmail)) {
    return jsonError("L’e-mail du bénéficiaire est invalide.");
  }

  const { data: giftCard, error: giftCardError } = await supabaseServer
    .from("gift_cards")
    .insert({
      buyer_name: buyerName,
      buyer_email: buyerEmail,
      recipient_name: recipientName || null,
      recipient_email: recipientEmail || null,
      message: message || null,
      amount_cents: amountCents,
      balance_cents: amountCents,
      currency: stripeCurrency(),
      status: "pending",
      expires_at: giftCardExpiryDate()
    })
    .select("id,code,amount_cents,currency")
    .single();

  if (giftCardError || !giftCard) {
    return jsonError(giftCardError?.message || "Impossible de créer la carte cadeau.", 500);
  }

  const stripe = getStripe();

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: buyerEmail,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: stripeCurrency(),
          unit_amount: amountCents,
          product_data: {
            name: "Carte cadeau Esthetic Diamonds & Spa",
            description: `Carte cadeau ${giftCard.code}`
          }
        }
      }
    ],
    success_url: `${appUrl()}/cartes-cadeaux?gift_payment=success`,
    cancel_url: `${appUrl()}/cartes-cadeaux?gift_payment=cancelled`,
    metadata: {
      type: "gift_card",
      gift_card_id: giftCard.id,
      gift_card_code: giftCard.code,
      buyer_email: buyerEmail
    },
    payment_intent_data: {
      metadata: {
        type: "gift_card",
        gift_card_id: giftCard.id,
        gift_card_code: giftCard.code
      }
    }
  });

  await supabaseServer
    .from("gift_cards")
    .update({
      stripe_checkout_session_id: session.id
    })
    .eq("id", giftCard.id);

  return NextResponse.json({
    ok: true,
    checkoutUrl: session.url
  });
}
