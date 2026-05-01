import Stripe from "stripe";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

export function isStripeEnabled() {
  return process.env.STRIPE_ENABLED === "true" && Boolean(stripeSecretKey);
}

export function getStripe() {
  if (!stripeSecretKey) {
    throw new Error("STRIPE_SECRET_KEY est manquant.");
  }

  return new Stripe(stripeSecretKey);
}

export function appUrl() {
  return process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
}

export function stripeCurrency() {
  return process.env.STRIPE_CURRENCY || "eur";
}
