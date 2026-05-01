import { createSign } from "crypto";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.events";

type GoogleCalendarEventPayload = {
  calendarId?: string | null;
  summary: string;
  description: string;
  startAt: string;
  endAt: string;
  timeZone?: string;
  location?: string;
};

function base64url(input: string | Buffer) {
  return Buffer.from(input)
    .toString("base64")
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

function getPrivateKey() {
  const key = process.env.GOOGLE_PRIVATE_KEY;

  if (!key) {
    throw new Error("GOOGLE_PRIVATE_KEY est manquant.");
  }

  return key.replace(/\\n/g, "\n");
}

function getServiceAccountEmail() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;

  if (!email) {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_EMAIL est manquant.");
  }

  return email;
}

function getDefaultCalendarId() {
  const calendarId = process.env.GOOGLE_CALENDAR_ID;

  if (!calendarId) {
    throw new Error("GOOGLE_CALENDAR_ID est manquant.");
  }

  return calendarId;
}

export function isGoogleCalendarEnabled() {
  return process.env.GOOGLE_CALENDAR_ENABLED === "true";
}

async function getGoogleAccessToken() {
  const now = Math.floor(Date.now() / 1000);

  const header = {
    alg: "RS256",
    typ: "JWT"
  };

  const claims = {
    iss: getServiceAccountEmail(),
    scope: GOOGLE_CALENDAR_SCOPE,
    aud: GOOGLE_TOKEN_URL,
    exp: now + 3600,
    iat: now
  };

  const unsignedJwt = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(claims))}`;

  const signer = createSign("RSA-SHA256");
  signer.update(unsignedJwt);
  signer.end();

  const signature = signer.sign(getPrivateKey());
  const assertion = `${unsignedJwt}.${base64url(signature)}`;

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion
    })
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(data?.error_description || data?.error || "Impossible d’obtenir un access token Google.");
  }

  return data.access_token as string;
}

export async function createGoogleCalendarEvent(payload: GoogleCalendarEventPayload) {
  if (!isGoogleCalendarEnabled()) {
    return {
      enabled: false as const,
      eventId: null,
      htmlLink: null,
      calendarId: null
    };
  }

  const accessToken = await getGoogleAccessToken();
  const calendarId = payload.calendarId || getDefaultCalendarId();

  const eventBody = {
    summary: payload.summary,
    description: payload.description,
    location: payload.location || "Hôtel Saint-Georges, Rue Gratien Parize, 97120 Saint-Claude",
    start: {
      dateTime: payload.startAt,
      timeZone: payload.timeZone || "America/Guadeloupe"
    },
    end: {
      dateTime: payload.endAt,
      timeZone: payload.timeZone || "America/Guadeloupe"
    },
    reminders: {
      useDefault: true
    }
  };

  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(eventBody)
    }
  );

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(data?.error?.message || "Impossible de créer l’événement Google Calendar.");
  }

  return {
    enabled: true as const,
    eventId: data.id as string,
    htmlLink: data.htmlLink as string | null,
    calendarId
  };
}

export async function deleteGoogleCalendarEvent({
  calendarId,
  eventId
}: {
  calendarId?: string | null;
  eventId: string;
}) {
  if (!isGoogleCalendarEnabled()) {
    return { enabled: false as const, deleted: false };
  }

  const accessToken = await getGoogleAccessToken();
  const targetCalendarId = calendarId || getDefaultCalendarId();

  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(
      targetCalendarId
    )}/events/${encodeURIComponent(eventId)}`,
    {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    }
  );

  if (response.status === 404 || response.status === 410) {
    return { enabled: true as const, deleted: true, alreadyMissing: true };
  }

  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(data?.error?.message || "Impossible de supprimer l’événement Google Calendar.");
  }

  return { enabled: true as const, deleted: true, alreadyMissing: false };
}

export function buildCalendarEventDescription(input: {
  bookingReference: string;
  clientFirstName: string;
  clientLastName: string;
  clientPhone: string;
  clientEmail: string;
  serviceName: string;
  priceLabel: string;
  comment?: string | null;
}) {
  return [
    `Référence : ${input.bookingReference}`,
    `Client : ${input.clientFirstName} ${input.clientLastName}`,
    `Téléphone : ${input.clientPhone}`,
    `E-mail : ${input.clientEmail}`,
    `Prestation : ${input.serviceName}`,
    `Prix : ${input.priceLabel}`,
    input.comment ? `Commentaire : ${input.comment}` : null,
    "",
    "Réservation créée depuis la plateforme Esthetic Diamonds & Spa."
  ]
    .filter(Boolean)
    .join("\\n");
}
