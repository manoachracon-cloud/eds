"use client";

import { useEffect, useState } from "react";

type BookingPublic = {
  id: string;
  bookingReference: string;
  status: string;
  startAt: string;
  endAt: string;
  durationMinutes: number;
  priceCents: number;
  paymentStatus: string;
  paymentAmountCents: number;
  paymentDueCents: number;
  giftCardCode: string | null;
  giftCardAmountCents: number;
  paymentMode: string;
  paymentRequired: boolean;
  paymentIsPaid: boolean;
  canCancel: boolean;
  cancellationMinHours: number;
  managementUrl: string;
  client: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
  };
  service: {
    name: string;
    durationMinutes: number;
  };
  employee: {
    name: string;
    role: string;
  } | null;
};

function dateLabel(value: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "America/Guadeloupe"
  }).format(new Date(value));
}

function timeLabel(value: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Guadeloupe"
  }).format(new Date(value));
}

function money(cents: number) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0
  }).format(cents / 100);
}

function paymentLabel(status: string) {
  const map: Record<string, string> = {
    unpaid: "Non payé",
    pending: "Paiement en attente",
    paid: "Payé",
    failed: "Échec paiement",
    cancelled: "Paiement annulé",
    refunded: "Remboursé",
    partially_paid: "Partiellement payé"
  };

  return map[status] || status;
}

function statusLabel(status: string) {
  const map: Record<string, string> = {
    confirmed: "Confirmé",
    cancelled: "Annulé",
    done: "Terminé",
    pending: "En attente"
  };

  return map[status] || status;
}

export default function BookingManageApp({ token }: { token: string }) {
  const [booking, setBooking] = useState<BookingPublic | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [cancelReason, setCancelReason] = useState("");
  const [requestedDate, setRequestedDate] = useState("");
  const [requestedTime, setRequestedTime] = useState("");
  const [message, setMessage] = useState("");

  async function loadBooking() {
    setLoading(true);
    setError("");

    const response = await fetch(`/api/bookings/manage?token=${encodeURIComponent(token)}`);
    const result = await response.json().catch(() => null);

    if (!response.ok || !result?.ok) {
      setError(result?.error || "Réservation introuvable.");
      setLoading(false);
      return;
    }

    setBooking(result.booking);
    setLoading(false);
  }

  useEffect(() => {
    loadBooking();
  }, [token]);

  async function cancelBooking() {
    if (!booking) return;

    const confirmed = window.confirm(
      "Confirmer l’annulation de ce rendez-vous ? Cette action libérera le créneau."
    );

    if (!confirmed) return;

    setActionLoading(true);
    setError("");
    setSuccess("");

    const response = await fetch("/api/bookings/manage", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        token,
        action: "cancel",
        reason: cancelReason
      })
    });

    const result = await response.json().catch(() => null);
    setActionLoading(false);

    if (!response.ok || !result?.ok) {
      setError(result?.error || "Impossible d’annuler cette réservation.");
      if (result?.booking) setBooking(result.booking);
      return;
    }

    setBooking(result.booking);
    setSuccess("Votre rendez-vous a bien été annulé. Un e-mail de confirmation a été envoyé.");
  }

  async function startPayment() {
    if (!booking) return;

    setActionLoading(true);
    setError("");
    setSuccess("");

    const response = await fetch("/api/payments/create-checkout-session", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ token })
    });

    const result = await response.json().catch(() => null);
    setActionLoading(false);

    if (!response.ok || !result?.ok) {
      setError(result?.error || "Impossible de créer le lien de paiement.");
      return;
    }

    if (result.alreadyPaid) {
      setSuccess("Cette réservation est déjà payée.");
      return;
    }

    window.location.href = result.checkoutUrl;
  }

  async function requestModification() {
    if (!booking) return;

    if (!requestedDate && !requestedTime && !message) {
      setError("Merci d’indiquer au moins une nouvelle date, un nouvel horaire ou un message.");
      return;
    }

    setActionLoading(true);
    setError("");
    setSuccess("");

    const response = await fetch("/api/bookings/manage", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        token,
        action: "request_modification",
        requestedDate,
        requestedTime,
        message
      })
    });

    const result = await response.json().catch(() => null);
    setActionLoading(false);

    if (!response.ok || !result?.ok) {
      setError(result?.error || "Impossible d’envoyer la demande de modification.");
      return;
    }

    setSuccess("Votre demande de modification a bien été envoyée. L’équipe vous recontactera.");
    setRequestedDate("");
    setRequestedTime("");
    setMessage("");
  }

  return (
    <>
      <div className="topbar">
        <div className="container topbar-inner">
          <span>
            <strong>ESTHETIC DIAMONDS & SPA</strong> · Gestion de réservation
          </span>
          <span>09 74 56 43 36 · Saint-Claude</span>
        </div>
      </div>

      <header className="header">
        <div className="container nav">
          <a className="brand" href="/">
            <div className="brand-mark">◆</div>
            <div>
              <div className="brand-name">Esthetic Diamonds</div>
              <div className="brand-sub">Gestion rendez-vous</div>
            </div>
          </a>
          <a className="btn btn-primary" href="/">
            Reprendre rendez-vous
          </a>
        </div>
      </header>

      <main className="section">
        <div className="container" style={{ maxWidth: 920 }}>
          <div className="eyebrow">Lien sécurisé</div>
          <h1 className="page-title">Gérer ma réservation</h1>
          <p className="section-desc">
            Consultez votre rendez-vous, demandez une modification ou annulez en respectant le délai prévu.
          </p>

          {loading && <div className="alert">Chargement de votre réservation...</div>}
          {error && <div className="error">{error}</div>}
          {success && <div className="success-box">{success}</div>}

          {!loading && booking && (
            <div className="grid grid-2" style={{ alignItems: "start", marginTop: 26 }}>
              <div className="card card-pad">
                <span className="badge">{statusLabel(booking.status)}</span>
                <h2 style={{ fontSize: 34, marginTop: 16 }}>{booking.service.name}</h2>
                <div className="summary-grid" style={{ marginTop: 22 }}>
                  <Summary label="Référence" value={booking.bookingReference} />
                  <Summary label="Date" value={dateLabel(booking.startAt)} />
                  <Summary label="Heure" value={timeLabel(booking.startAt)} />
                  <Summary label="Durée" value={`${booking.durationMinutes} min`} />
                  <Summary label="Prix" value={money(booking.priceCents)} />
                  <Summary label="Employé" value={booking.employee?.name || "Attribution automatique"} />
                </div>
                <div className="summary-item" style={{ marginTop: 16 }}>
                  <small>Client</small>
                  <strong>
                    {booking.client.firstName} {booking.client.lastName}
                  </strong>
                  <p className="muted" style={{ marginTop: 8 }}>
                    {booking.client.email}
                    <br />
                    {booking.client.phone}
                  </p>
                </div>

                <div className="summary-item" style={{ marginTop: 16 }}>
                  <small>Paiement</small>
                  <strong>{paymentLabel(booking.paymentStatus)}</strong>
                  <p className="muted" style={{ marginTop: 8 }}>
                    {booking.giftCardAmountCents > 0
                      ? `Carte cadeau utilisée : -${money(booking.giftCardAmountCents)}. Reste à payer : ${money(booking.paymentDueCents)}.`
                      : booking.paymentRequired
                        ? booking.paymentIsPaid
                          ? "Le paiement est confirmé."
                          : "Un paiement est requis pour cette réservation."
                        : "Paiement sur place prévu."}
                  </p>
                  {booking.paymentRequired && !booking.paymentIsPaid && booking.status === "confirmed" && (
                    <button
                      className="btn btn-primary"
                      style={{ width: "100%", marginTop: 16 }}
                      disabled={actionLoading}
                      onClick={startPayment}
                    >
                      Payer maintenant
                    </button>
                  )}
                </div>
              </div>

              <div className="card card-pad">
                <h2 style={{ fontSize: 30 }}>Actions disponibles</h2>

                {booking.status !== "confirmed" && (
                  <div className="alert">
                    Cette réservation n’est plus modifiable en ligne car son statut est : {statusLabel(booking.status)}.
                  </div>
                )}

                {booking.status === "confirmed" && (
                  <>
                    <div style={{ marginTop: 22 }}>
                      <h3 style={{ fontSize: 24 }}>Demander une modification</h3>
                      <p className="muted" style={{ marginTop: 8 }}>
                        Votre rendez-vous actuel reste confirmé tant que l’équipe n’a pas validé la modification.
                      </p>
                      <div className="form-grid" style={{ marginTop: 16 }}>
                        <label>
                          <span>Nouvelle date souhaitée</span>
                          <input
                            className="input"
                            type="date"
                            value={requestedDate}
                            onChange={(event) => setRequestedDate(event.target.value)}
                          />
                        </label>
                        <label>
                          <span>Nouvel horaire souhaité</span>
                          <input
                            className="input"
                            type="time"
                            value={requestedTime}
                            onChange={(event) => setRequestedTime(event.target.value)}
                          />
                        </label>
                      </div>
                      <label style={{ display: "block", marginTop: 16 }}>
                        <span>Message pour l’équipe</span>
                        <textarea
                          value={message}
                          onChange={(event) => setMessage(event.target.value)}
                          placeholder="Expliquez votre demande..."
                        />
                      </label>
                      <button
                        className="btn btn-primary"
                        style={{ width: "100%", marginTop: 16 }}
                        disabled={actionLoading}
                        onClick={requestModification}
                      >
                        Envoyer ma demande
                      </button>
                    </div>

                    <div style={{ marginTop: 28, paddingTop: 24, borderTop: "1px solid var(--line)" }}>
                      <h3 style={{ fontSize: 24 }}>Annuler le rendez-vous</h3>
                      {booking.canCancel ? (
                        <>
                          <p className="muted" style={{ marginTop: 8 }}>
                            L’annulation en ligne est possible jusqu’à {booking.cancellationMinHours}h avant le rendez-vous.
                          </p>
                          <label style={{ display: "block", marginTop: 16 }}>
                            <span>Raison de l’annulation</span>
                            <textarea
                              value={cancelReason}
                              onChange={(event) => setCancelReason(event.target.value)}
                              placeholder="Optionnel"
                            />
                          </label>
                          <button
                            className="btn btn-danger"
                            style={{ width: "100%", marginTop: 16 }}
                            disabled={actionLoading}
                            onClick={cancelBooking}
                          >
                            Annuler mon rendez-vous
                          </button>
                        </>
                      ) : (
                        <div className="alert">
                          L’annulation en ligne n’est plus disponible à moins de {booking.cancellationMinHours}h du rendez-vous.
                          Merci de contacter directement l’équipe.
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </main>
    </>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="summary-item">
      <small>{label}</small>
      <strong>{value}</strong>
    </div>
  );
}
