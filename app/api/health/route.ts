import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

export const runtime = "nodejs";

type CheckStatus = "ok" | "warning" | "error" | "disabled";

type HealthCheck = {
  key: string;
  label: string;
  status: CheckStatus;
  message: string;
  required: boolean;
  details?: Record<string, unknown>;
};

function hasEnv(name: string) {
  return Boolean(process.env[name] && String(process.env[name]).trim().length > 0);
}

function envCheck(key: string, label: string, names: string[], required = true): HealthCheck {
  const missing = names.filter((name) => !hasEnv(name));

  if (missing.length === 0) {
    return {
      key,
      label,
      status: "ok",
      message: "Configuration présente.",
      required
    };
  }

  return {
    key,
    label,
    status: required ? "error" : "warning",
    message: `Variable(s) manquante(s) : ${missing.join(", ")}`,
    required,
    details: { missing }
  };
}

async function supabaseCheck(): Promise<HealthCheck> {
  try {
    const { error } = await supabaseServer.from("settings").select("key").limit(1);

    if (error) {
      return {
        key: "supabase_connection",
        label: "Connexion Supabase",
        status: "error",
        message: error.message,
        required: true
      };
    }

    return {
      key: "supabase_connection",
      label: "Connexion Supabase",
      status: "ok",
      message: "Supabase répond correctement.",
      required: true
    };
  } catch (error: any) {
    return {
      key: "supabase_connection",
      label: "Connexion Supabase",
      status: "error",
      message: error?.message || "Erreur Supabase inconnue.",
      required: true
    };
  }
}

async function resendCheck(): Promise<HealthCheck> {
  if (!hasEnv("RESEND_API_KEY") || !hasEnv("RESEND_FROM_EMAIL")) {
    return envCheck("resend", "Resend e-mail", ["RESEND_API_KEY", "RESEND_FROM_EMAIL"], true);
  }

  return {
    key: "resend",
    label: "Resend e-mail",
    status: "ok",
    message: "Variables Resend présentes. Test d’envoi non déclenché automatiquement.",
    required: true
  };
}

function stripeCheck(): HealthCheck {
  const enabled = process.env.STRIPE_ENABLED === "true";

  if (!enabled) {
    return {
      key: "stripe",
      label: "Stripe",
      status: "disabled",
      message: "Stripe est désactivé.",
      required: false
    };
  }

  return envCheck("stripe", "Stripe", ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"], true);
}

function googleCalendarCheck(): HealthCheck {
  const enabled = process.env.GOOGLE_CALENDAR_ENABLED === "true";

  if (!enabled) {
    return {
      key: "google_calendar",
      label: "Google Calendar",
      status: "disabled",
      message: "Google Calendar est désactivé.",
      required: false
    };
  }

  return envCheck(
    "google_calendar",
    "Google Calendar",
    ["GOOGLE_SERVICE_ACCOUNT_EMAIL", "GOOGLE_PRIVATE_KEY", "GOOGLE_CALENDAR_ID"],
    true
  );
}

function whatsappCheck(): HealthCheck {
  const enabled = process.env.WHATSAPP_ENABLED === "true";

  if (!enabled) {
    return {
      key: "whatsapp",
      label: "WhatsApp Business",
      status: "disabled",
      message: "WhatsApp est désactivé.",
      required: false
    };
  }

  return envCheck(
    "whatsapp",
    "WhatsApp Business",
    ["WHATSAPP_PHONE_NUMBER_ID", "WHATSAPP_ACCESS_TOKEN", "WHATSAPP_INTERNAL_TO"],
    true
  );
}

function cronCheck(): HealthCheck {
  return envCheck("cron", "Cron & rappels", ["CRON_SECRET"], true);
}

function appUrlCheck(): HealthCheck {
  return envCheck("app_url", "URL publique", ["NEXT_PUBLIC_APP_URL"], true);
}

function recoveryCheck(): HealthCheck {
  return envCheck("error_recovery", "Reprise d’erreur", ["ERROR_RECOVERY_ENABLED"], false);
}

function healthEnabled() {
  return process.env.HEALTHCHECK_ENABLED !== "false";
}

function isAuthorized(request: NextRequest) {
  const secret = process.env.HEALTHCHECK_SECRET;
  const authHeader = request.headers.get("authorization");
  const querySecret = request.nextUrl.searchParams.get("secret");

  if (!secret) return true;

  return authHeader === `Bearer ${secret}` || querySecret === secret;
}

export async function GET(request: NextRequest) {
  if (!healthEnabled()) {
    return NextResponse.json(
      {
        ok: false,
        status: "disabled",
        message: "Healthcheck désactivé."
      },
      { status: 503 }
    );
  }

  if (!isAuthorized(request)) {
    return NextResponse.json(
      {
        ok: false,
        status: "unauthorized",
        message: "Accès non autorisé."
      },
      { status: 401 }
    );
  }

  const startedAt = Date.now();

  const checks: HealthCheck[] = [
    appUrlCheck(),
    envCheck(
      "supabase_env",
      "Variables Supabase",
      ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "SUPABASE_SERVICE_ROLE_KEY"],
      true
    ),
    await supabaseCheck(),
    await resendCheck(),
    stripeCheck(),
    googleCalendarCheck(),
    whatsappCheck(),
    cronCheck(),
    recoveryCheck()
  ];

  const errors = checks.filter((check) => check.status === "error");
  const warnings = checks.filter((check) => check.status === "warning");

  const status = errors.length > 0 ? "error" : warnings.length > 0 ? "warning" : "ok";

  return NextResponse.json(
    {
      ok: status !== "error",
      status,
      environment: process.env.NODE_ENV || "unknown",
      appUrl: process.env.NEXT_PUBLIC_APP_URL || null,
      generatedAt: new Date().toISOString(),
      latencyMs: Date.now() - startedAt,
      summary: {
        total: checks.length,
        ok: checks.filter((check) => check.status === "ok").length,
        warning: warnings.length,
        error: errors.length,
        disabled: checks.filter((check) => check.status === "disabled").length
      },
      checks
    },
    { status: status === "error" ? 500 : 200 }
  );
}
