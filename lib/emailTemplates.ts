type BookingEmailPayload = {
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
  managementUrl?: string | null;
  giftCardAppliedLabel?: string | null;
  remainingDueLabel?: string | null;
};

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

const shellStart = `
  <div style="margin:0;padding:0;background:#F7FBFB;font-family:Arial,Helvetica,sans-serif;color:#071B1D;">
    <div style="max-width:640px;margin:0 auto;padding:32px 18px;">
      <div style="background:#ffffff;border:1px solid #DCEAEA;border-radius:28px;overflow:hidden;box-shadow:0 18px 48px rgba(3,17,19,.08);">
        <div style="background:linear-gradient(135deg,#071B1D,#07383A);padding:30px;color:#ffffff;">
          <div style="display:inline-block;background:rgba(0,215,213,.15);border:1px solid rgba(0,215,213,.35);color:#00D7D5;border-radius:999px;padding:7px 12px;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;">Esthetic Diamonds & Spa</div>
`;

const shellEnd = `
        <div style="padding:24px 30px 30px;border-top:1px solid #DCEAEA;">
          <p style="margin:0;color:#5E7274;font-size:13px;line-height:1.6;">
            Hôtel Saint-Georges, Rue Gratien Parize, 97120 Saint-Claude<br/>
            09 74 56 43 36
          </p>
        </div>
      </div>
    </div>
  </div>
`;

function row(label: string, value: unknown) {
  return `
    <tr>
      <td style="padding:11px 0;color:#5E7274;font-size:14px;border-bottom:1px solid #E9F7F7;">${escapeHtml(label)}</td>
      <td style="padding:11px 0;color:#071B1D;font-size:14px;font-weight:700;text-align:right;border-bottom:1px solid #E9F7F7;">${escapeHtml(value)}</td>
    </tr>
  `;
}

export function customerConfirmationEmail(payload: BookingEmailPayload) {
  const html = `
    ${shellStart}
          <h1 style="margin:18px 0 0;font-size:30px;line-height:1.12;color:#ffffff;">Votre rendez-vous est confirmé.</h1>
          <p style="margin:12px 0 0;color:rgba(255,255,255,.72);font-size:15px;line-height:1.6;">Bonjour ${escapeHtml(payload.clientFirstName)}, nous avons bien enregistré votre réservation.</p>
        </div>
        <div style="padding:30px;">
          <table style="width:100%;border-collapse:collapse;">
            ${row("Référence", payload.bookingReference)}
            ${row("Prestation", payload.serviceName)}
            ${row("Date", payload.dateLabel)}
            ${row("Heure", payload.timeLabel)}
            ${row("Durée", `${payload.durationMinutes} min`)}
            ${row("Prix", payload.priceLabel)}
            ${payload.giftCardAppliedLabel ? row("Carte cadeau utilisée", payload.giftCardAppliedLabel) : ""}
            ${payload.remainingDueLabel ? row("Reste à payer", payload.remainingDueLabel) : ""}
            ${row("Employé", payload.employeeName || "Attribution automatique")}
          </table>
          <div style="margin-top:24px;background:#F2FAFA;border-radius:20px;padding:18px;">
            <p style="margin:0;color:#071B1D;font-size:14px;line-height:1.65;">
              Merci d’arriver quelques minutes avant votre rendez-vous. En cas d’empêchement, vous pouvez gérer votre réservation depuis le lien ci-dessous.
            </p>
            ${
              payload.managementUrl
                ? `<a href="${escapeHtml(payload.managementUrl)}" style="display:inline-block;margin-top:16px;background:#00D7D5;color:#031113;text-decoration:none;font-weight:700;border-radius:999px;padding:12px 18px;">Modifier ou annuler ma réservation</a>`
                : ""
            }
          </div>
        </div>
    ${shellEnd}
  `;

  return {
    subject: `Votre rendez-vous Esthetic Diamonds & Spa est confirmé`,
    html
  };
}

export function internalNotificationEmail(payload: BookingEmailPayload) {
  const html = `
    ${shellStart}
          <h1 style="margin:18px 0 0;font-size:30px;line-height:1.12;color:#ffffff;">Nouvelle réservation.</h1>
          <p style="margin:12px 0 0;color:rgba(255,255,255,.72);font-size:15px;line-height:1.6;">Une nouvelle réservation vient d’être enregistrée sur la plateforme.</p>
        </div>
        <div style="padding:30px;">
          <table style="width:100%;border-collapse:collapse;">
            ${row("Référence", payload.bookingReference)}
            ${row("Client", `${payload.clientFirstName} ${payload.clientLastName}`)}
            ${row("Téléphone", payload.clientPhone)}
            ${row("E-mail", payload.clientEmail)}
            ${row("Prestation", payload.serviceName)}
            ${row("Date", payload.dateLabel)}
            ${row("Heure", payload.timeLabel)}
            ${row("Durée", `${payload.durationMinutes} min`)}
            ${row("Prix", payload.priceLabel)}
            ${payload.giftCardAppliedLabel ? row("Carte cadeau utilisée", payload.giftCardAppliedLabel) : ""}
            ${payload.remainingDueLabel ? row("Reste à payer", payload.remainingDueLabel) : ""}
            ${row("Employé", payload.employeeName || "Attribution automatique")}
          </table>
          ${
            payload.comment
              ? `<div style="margin-top:24px;background:#F2FAFA;border-radius:20px;padding:18px;"><p style="margin:0;color:#071B1D;font-size:14px;line-height:1.65;"><strong>Commentaire client :</strong><br/>${escapeHtml(payload.comment)}</p></div>`
              : ""
          }
        </div>
    ${shellEnd}
  `;

  return {
    subject: `Nouvelle réservation — ${payload.serviceName}`,
    html
  };
}
