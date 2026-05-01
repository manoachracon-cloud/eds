"use client";

import { useMemo, useState } from "react";

const presetAmounts = [5000, 7500, 10000, 15000, 20000];

function money(cents: number) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0
  }).format(cents / 100);
}

export default function GiftCardsApp() {
  const [amountCents, setAmountCents] = useState(7500);
  const [customAmount, setCustomAmount] = useState("");
  const [buyerName, setBuyerName] = useState("");
  const [buyerEmail, setBuyerEmail] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const finalAmount = useMemo(() => {
    const custom = Number(customAmount);
    if (customAmount && Number.isFinite(custom) && custom > 0) {
      return Math.round(custom * 100);
    }
    return amountCents;
  }, [amountCents, customAmount]);

  async function startCheckout() {
    setError("");

    if (!buyerName || !buyerEmail) {
      setError("Merci de renseigner votre nom et votre e-mail.");
      return;
    }

    if (finalAmount < 1000) {
      setError("Le montant minimum est de 10 €.");
      return;
    }

    setSubmitting(true);

    const response = await fetch("/api/gift-cards/create-checkout-session", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        amountCents: finalAmount,
        buyerName,
        buyerEmail,
        recipientName,
        recipientEmail,
        message
      })
    });

    const result = await response.json().catch(() => null);
    setSubmitting(false);

    if (!response.ok || !result?.ok) {
      setError(result?.error || "Impossible de créer le paiement.");
      return;
    }

    window.location.href = result.checkoutUrl;
  }

  return (
    <>
      <div className="topbar">
        <div className="container topbar-inner">
          <span>
            <strong>ESTHETIC DIAMONDS & SPA</strong> · Cartes cadeaux
          </span>
          <span>Offrir une parenthèse de bien-être</span>
        </div>
      </div>

      <header className="header">
        <div className="container nav">
          <a className="brand" href="/">
            <div className="brand-mark">◆</div>
            <div>
              <div className="brand-name">Esthetic Diamonds</div>
              <div className="brand-sub">Cartes cadeaux</div>
            </div>
          </a>
          <div className="nav-links">
            <a href="/">Réservation</a>
            <a href="/admin">Admin</a>
          </div>
          <a className="btn btn-primary" href="/">
            Réserver un soin
          </a>
        </div>
      </header>

      <main>
        <section className="hero" style={{ minHeight: "auto" }}>
          <div className="container" style={{ minHeight: 520 }}>
            <div>
              <div className="hero-kicker">Coffrets & cartes cadeaux</div>
              <h1>Offrir un moment de bien-être premium.</h1>
              <p>
                Choisissez un montant, ajoutez un message personnalisé et laissez Esthetic Diamonds & Spa offrir une expérience sensorielle au bénéficiaire.
              </p>
            </div>

            <div className="hero-card">
              <span className="badge">Carte cadeau digitale</span>
              <h2>Code unique envoyé après paiement</h2>
              <p>
                Le code est généré automatiquement et activé uniquement après validation du paiement Stripe.
              </p>
              <div className="hero-mini-grid">
                <div className="hero-mini">
                  <strong>{money(finalAmount)}</strong>
                  <span>Montant sélectionné</span>
                </div>
                <div className="hero-mini">
                  <strong>12 mois</strong>
                  <span>Durée par défaut</span>
                </div>
                <div className="hero-mini">
                  <strong>Stripe</strong>
                  <span>Paiement sécurisé</span>
                </div>
                <div className="hero-mini">
                  <strong>E-mail</strong>
                  <span>Envoi au bénéficiaire</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="section">
          <div className="container" style={{ maxWidth: 980 }}>
            <div className="grid grid-2" style={{ alignItems: "start" }}>
              <div className="card card-pad">
                <div className="eyebrow">Montant</div>
                <h2 style={{ fontSize: 38 }}>Choisir la valeur de la carte</h2>

                <div className="filters">
                  {presetAmounts.map((amount) => (
                    <button
                      key={amount}
                      className={`filter ${!customAmount && amountCents === amount ? "active" : ""}`}
                      onClick={() => {
                        setCustomAmount("");
                        setAmountCents(amount);
                      }}
                    >
                      {money(amount)}
                    </button>
                  ))}
                </div>

                <label>
                  <span>Montant personnalisé en euros</span>
                  <input
                    className="input"
                    type="number"
                    min="10"
                    max="1000"
                    value={customAmount}
                    onChange={(event) => setCustomAmount(event.target.value)}
                    placeholder="Exemple : 120"
                  />
                </label>

                <div className="summary-item" style={{ marginTop: 18 }}>
                  <small>Total</small>
                  <strong>{money(finalAmount)}</strong>
                </div>
              </div>

              <div className="card card-pad">
                <div className="eyebrow">Informations</div>
                <h2 style={{ fontSize: 38 }}>Acheteur & bénéficiaire</h2>

                <div className="form-grid" style={{ marginTop: 22 }}>
                  <label>
                    <span>Votre nom</span>
                    <input className="input" value={buyerName} onChange={(event) => setBuyerName(event.target.value)} />
                  </label>
                  <label>
                    <span>Votre e-mail</span>
                    <input className="input" value={buyerEmail} onChange={(event) => setBuyerEmail(event.target.value)} />
                  </label>
                </div>

                <div className="form-grid" style={{ marginTop: 16 }}>
                  <label>
                    <span>Nom du bénéficiaire</span>
                    <input className="input" value={recipientName} onChange={(event) => setRecipientName(event.target.value)} />
                  </label>
                  <label>
                    <span>E-mail du bénéficiaire</span>
                    <input className="input" value={recipientEmail} onChange={(event) => setRecipientEmail(event.target.value)} />
                  </label>
                </div>

                <label style={{ display: "block", marginTop: 16 }}>
                  <span>Message personnalisé</span>
                  <textarea
                    value={message}
                    onChange={(event) => setMessage(event.target.value)}
                    placeholder="Exemple : Joyeuse fête des mères, profite de ce moment pour toi."
                  />
                </label>

                {error && <div className="error">{error}</div>}

                <button
                  className="btn btn-primary"
                  style={{ width: "100%", marginTop: 18 }}
                  disabled={submitting}
                  onClick={startCheckout}
                >
                  {submitting ? "Création du paiement..." : `Acheter la carte cadeau — ${money(finalAmount)}`}
                </button>

                <p className="muted" style={{ marginTop: 14 }}>
                  Le code de la carte cadeau sera activé après confirmation du paiement par Stripe.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
