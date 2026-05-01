"use client";

import { useEffect, useMemo, useState } from "react";

type HealthCheck = {
  key: string;
  label: string;
  status: "ok" | "warning" | "error" | "disabled";
  message: string;
  required: boolean;
  details?: Record<string, unknown>;
};

type HealthResponse = {
  ok: boolean;
  status: "ok" | "warning" | "error" | "disabled";
  environment: string;
  appUrl: string | null;
  generatedAt: string;
  latencyMs: number;
  summary: {
    total: number;
    ok: number;
    warning: number;
    error: number;
    disabled: number;
  };
  checks: HealthCheck[];
};

function dateTimeLabel(value: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Guadeloupe"
  }).format(new Date(value));
}

function badgeTone(value: string) {
  if (value === "ok") return "success";
  if (value === "error") return "danger";
  if (value === "warning") return "warning";
  if (value === "disabled") return "dark";
  return "dark";
}

function statusBadge(value: string) {
  return <span className={`badge ${badgeTone(value)}`}>{value}</span>;
}

const deploymentChecklist = [
  "Créer le projet Supabase production.",
  "Exécuter les migrations SQL dans l’ordre.",
  "Créer au moins un compte admin dans Supabase Auth.",
  "Créer le profil correspondant dans user_profiles avec le rôle super_admin.",
  "Créer le projet Vercel et connecter le repository.",
  "Configurer toutes les variables d’environnement production.",
  "Configurer le domaine de réservation.",
  "Configurer Resend avec un domaine vérifié.",
  "Configurer Stripe Checkout + webhook production.",
  "Configurer Google Calendar Service Account et partager le calendrier avec le service account.",
  "Configurer WhatsApp Business Cloud API si le canal WhatsApp est activé.",
  "Tester une réservation complète.",
  "Tester un paiement Stripe.",
  "Tester une annulation.",
  "Tester un rappel cron.",
  "Tester une séance Aqua-sports.",
  "Tester une carte cadeau.",
  "Vérifier le centre de notifications après les tests."
];

const requiredEnv = [
  "NEXT_PUBLIC_APP_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "RESEND_API_KEY",
  "RESEND_FROM_EMAIL",
  "INTERNAL_NOTIFICATION_EMAIL",
  "CRON_SECRET",
  "HEALTHCHECK_SECRET"
];

const optionalEnv = [
  "STRIPE_ENABLED",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "GOOGLE_CALENDAR_ENABLED",
  "GOOGLE_SERVICE_ACCOUNT_EMAIL",
  "GOOGLE_PRIVATE_KEY",
  "GOOGLE_CALENDAR_ID",
  "WHATSAPP_ENABLED",
  "WHATSAPP_PHONE_NUMBER_ID",
  "WHATSAPP_ACCESS_TOKEN",
  "WHATSAPP_INTERNAL_TO"
];

export default function SystemStatus() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [healthError, setHealthError] = useState("");
  const [secret, setSecret] = useState("");

  async function loadHealth() {
    setLoading(true);
    setHealthError("");

    const url = secret ? `/api/health?secret=${encodeURIComponent(secret)}` : "/api/health";
    const response = await fetch(url);
    const result = await response.json().catch(() => null);

    setLoading(false);

    if (!response.ok || !result) {
      setHealthError(result?.message || result?.error || "Impossible de lire le statut système.");
      setHealth(result);
      return;
    }

    setHealth(result);
  }

  useEffect(() => {
    loadHealth();
  }, []);

  const readinessScore = useMemo(() => {
    if (!health?.summary?.total) return 0;
    return Math.round(((health.summary.ok + health.summary.disabled * 0.5) / health.summary.total) * 100);
  }, [health]);

  return (
    <>
      <div className="section-head">
        <div>
          <div className="eyebrow">Production readiness</div>
          <h1 className="page-title">Statut production</h1>
          <p className="section-desc">
            Vérification des intégrations, variables critiques, checklist de déploiement et état général de la plateforme.
          </p>
        </div>
      </div>

      <div className="card card-pad" style={{ marginBottom: 22 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
          <div>
            <h2 style={{ fontSize: 30 }}>Healthcheck</h2>
            <p className="muted" style={{ marginTop: 8 }}>
              Route technique : <strong>/api/health</strong>
            </p>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <input
              className="input"
              style={{ maxWidth: 280 }}
              value={secret}
              onChange={(event) => setSecret(event.target.value)}
              placeholder="HEALTHCHECK_SECRET si configuré"
            />
            <button className="btn btn-primary" onClick={loadHealth} disabled={loading}>
              {loading ? "Vérification..." : "Vérifier"}
            </button>
          </div>
        </div>

        {healthError && <div className="error">{healthError}</div>}

        {health && (
          <div className="grid grid-4" style={{ marginTop: 22 }}>
            <Metric label="Statut" value={health.status.toUpperCase()} />
            <Metric label="Score readiness" value={`${readinessScore}%`} />
            <Metric label="Latence" value={`${health.latencyMs} ms`} />
            <Metric label="Généré" value={dateTimeLabel(health.generatedAt)} />
          </div>
        )}
      </div>

      {health && (
        <div className="card card-pad" style={{ marginBottom: 22 }}>
          <h2 style={{ fontSize: 30 }}>Statut des intégrations</h2>
          <div className="table" style={{ marginTop: 18 }}>
            <div className="tr head">
              <span>Intégration</span>
              <span>Statut</span>
              <span>Message</span>
              <span>Critique</span>
            </div>
            {health.checks.map((check) => (
              <div className="tr" key={check.key}>
                <div>
                  <strong>{check.label}</strong>
                  <br />
                  <span className="muted">{check.key}</span>
                </div>
                <div>{statusBadge(check.status)}</div>
                <div className="muted">{check.message}</div>
                <div>{check.required ? statusBadge("required") : statusBadge("optional")}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-2" style={{ alignItems: "start" }}>
        <div className="card card-pad">
          <h2 style={{ fontSize: 30 }}>Checklist de déploiement</h2>
          <p className="muted" style={{ marginTop: 8 }}>
            À valider avant mise en production client.
          </p>
          <div style={{ display: "grid", gap: 10, marginTop: 18 }}>
            {deploymentChecklist.map((item, index) => (
              <label
                key={item}
                style={{
                  display: "flex",
                  gap: 10,
                  alignItems: "flex-start",
                  border: "1px solid var(--line)",
                  borderRadius: 18,
                  padding: 12,
                  background: "white"
                }}
              >
                <input type="checkbox" />
                <span style={{ margin: 0 }}>
                  <strong>Étape {index + 1}</strong>
                  <br />
                  <span className="muted">{item}</span>
                </span>
              </label>
            ))}
          </div>
        </div>

        <div className="card card-pad">
          <h2 style={{ fontSize: 30 }}>Variables d’environnement</h2>
          <p className="muted" style={{ marginTop: 8 }}>
            À configurer dans Vercel, pas seulement en local.
          </p>

          <h3 style={{ marginTop: 22, fontSize: 22 }}>Obligatoires</h3>
          <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
            {requiredEnv.map((name) => (
              <code key={name} style={{ background: "var(--soft)", borderRadius: 12, padding: 10 }}>
                {name}
              </code>
            ))}
          </div>

          <h3 style={{ marginTop: 22, fontSize: 22 }}>Optionnelles selon modules activés</h3>
          <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
            {optionalEnv.map((name) => (
              <code key={name} style={{ background: "var(--soft)", borderRadius: 12, padding: 10 }}>
                {name}
              </code>
            ))}
          </div>
        </div>
      </div>

      <div className="card card-pad" style={{ marginTop: 22 }}>
        <h2 style={{ fontSize: 30 }}>Ordre de validation recommandé</h2>
        <div className="summary-grid" style={{ marginTop: 18 }}>
          <Summary label="1" value="Supabase + migrations" />
          <Summary label="2" value="Admin Auth + rôles" />
          <Summary label="3" value="Réservation sans paiement" />
          <Summary label="4" value="E-mails Resend" />
          <Summary label="5" value="Google Calendar" />
          <Summary label="6" value="Stripe + webhook" />
          <Summary label="7" value="WhatsApp si activé" />
          <Summary label="8" value="Cron rappels" />
          <Summary label="9" value="Aqua-sports + liste d’attente" />
          <Summary label="10" value="Cartes cadeaux" />
        </div>
      </div>
    </>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric">
      <small>{label}</small>
      <strong>{value}</strong>
    </div>
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
