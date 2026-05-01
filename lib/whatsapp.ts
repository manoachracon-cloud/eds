type WhatsAppBookingPayload = {
  bookingReference: string;
  clientFirstName: string;
  clientLastName: string;
  clientPhone: string;
  clientEmail: string;
  serviceName: string;
  employeeName?: string | null;
  dateLabel: string;
  timeLabel: string;
  durationMinutes: number;
  priceLabel: string;
  comment?: string | null;
};

type WhatsAppResult =
  | {
      enabled: false;
      status: "disabled";
    }
  | {
      enabled: true;
      status: "sent";
      providerMessageId?: string;
      providerResponse?: unknown;
      recipient: string;
      message: string;
    };

function requiredEnv(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} est manquant.`);
  }

  return value;
}

function normalizeWhatsAppPhone(value: string) {
  return value.replace(/[^\d]/g, "");
}

export function isWhatsAppEnabled() {
  return process.env.WHATSAPP_ENABLED === "true";
}

export function buildInternalWhatsAppMessage(payload: WhatsAppBookingPayload) {
  return [
    "Nouvelle réservation Esthetic Diamonds & Spa",
    "",
    `Référence : ${payload.bookingReference}`,
    `Client : ${payload.clientFirstName} ${payload.clientLastName}`,
    `Téléphone : ${payload.clientPhone}`,
    `E-mail : ${payload.clientEmail}`,
    `Prestation : ${payload.serviceName}`,
    `Date : ${payload.dateLabel}`,
    `Heure : ${payload.timeLabel}`,
    `Durée : ${payload.durationMinutes} min`,
    `Prix : ${payload.priceLabel}`,
    `Employé : ${payload.employeeName || "Attribution automatique"}`,
    payload.comment ? `Commentaire : ${payload.comment}` : null,
    "",
    "Réservation ajoutée au planning."
  ]
    .filter(Boolean)
    .join("\n");
}

async function callWhatsAppCloudApi(body: Record<string, unknown>) {
  const version = process.env.WHATSAPP_GRAPH_API_VERSION || "v22.0";
  const phoneNumberId = requiredEnv("WHATSAPP_PHONE_NUMBER_ID");
  const accessToken = requiredEnv("WHATSAPP_ACCESS_TOKEN");

  const response = await fetch(
    `https://graph.facebook.com/${version}/${encodeURIComponent(phoneNumberId)}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    }
  );

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(
      data?.error?.message ||
        data?.error?.error_user_msg ||
        data?.message ||
        "Erreur WhatsApp Business Cloud API."
    );
  }

  return data;
}

async function sendTextMessage(to: string, message: string): Promise<WhatsAppResult> {
  const data = await callWhatsAppCloudApi({
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to,
    type: "text",
    text: {
      preview_url: false,
      body: message
    }
  });

  return {
    enabled: true,
    status: "sent",
    providerMessageId: data?.messages?.[0]?.id,
    providerResponse: data,
    recipient: to,
    message
  };
}

async function sendTemplateMessage(
  to: string,
  payload: WhatsAppBookingPayload
): Promise<WhatsAppResult> {
  const templateName = process.env.WHATSAPP_TEMPLATE_NAME || "internal_booking_notification";
  const languageCode = process.env.WHATSAPP_TEMPLATE_LANGUAGE || "fr";
  const message = buildInternalWhatsAppMessage(payload);

  const data = await callWhatsAppCloudApi({
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to,
    type: "template",
    template: {
      name: templateName,
      language: {
        code: languageCode
      },
      components: [
        {
          type: "body",
          parameters: [
            { type: "text", text: payload.bookingReference },
            { type: "text", text: `${payload.clientFirstName} ${payload.clientLastName}` },
            { type: "text", text: payload.clientPhone },
            { type: "text", text: payload.serviceName },
            { type: "text", text: payload.dateLabel },
            { type: "text", text: payload.timeLabel },
            { type: "text", text: payload.employeeName || "Attribution automatique" },
            { type: "text", text: payload.priceLabel }
          ]
        }
      ]
    }
  });

  return {
    enabled: true,
    status: "sent",
    providerMessageId: data?.messages?.[0]?.id,
    providerResponse: data,
    recipient: to,
    message
  };
}

export async function sendInternalWhatsAppBookingNotification(
  payload: WhatsAppBookingPayload
): Promise<WhatsAppResult> {
  if (!isWhatsAppEnabled()) {
    return {
      enabled: false,
      status: "disabled"
    };
  }

  const to = normalizeWhatsAppPhone(requiredEnv("WHATSAPP_INTERNAL_TO"));

  if (!to) {
    throw new Error("WHATSAPP_INTERNAL_TO est invalide.");
  }

  const mode = process.env.WHATSAPP_INTERNAL_MODE || "text";

  if (mode === "template") {
    return sendTemplateMessage(to, payload);
  }

  return sendTextMessage(to, buildInternalWhatsAppMessage(payload));
}
