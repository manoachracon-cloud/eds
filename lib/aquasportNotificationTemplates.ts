type AquaSportNotificationPayload = {
  clientFirstName?: string | null;
  clientLastName?: string | null;
  classTitle: string;
  serviceName: string;
  coachName?: string | null;
  dateLabel: string;
  timeLabel: string;
  endTimeLabel?: string | null;
  oldDateLabel?: string | null;
  oldTimeLabel?: string | null;
  reason?: string | null;
  instructions?: string | null;
  managementUrl?: string | null;
};

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function shell(title: string, intro: string, content: string) {
  return `
  <div style="margin:0;padding:0;background:#F7FBFB;font-family:Arial,Helvetica,sans-serif;color:#071B1D;">
    <div style="max-width:680px;margin:0 auto;padding:32px 18px;">
      <div style="background:#ffffff;border:1px solid #DCEAEA;border-radius:28px;overflow:hidden;box-shadow:0 18px 48px rgba(3,17,19,.08);">
        <div style="background:linear-gradient(135deg,#071B1D,#07383A);padding:30px;color:#ffffff;">
          <div style="display:inline-block;background:rgba(0,215,213,.15);border:1px solid rgba(0,215,213,.35);color:#00D7D5;border-radius:999px;padding:7px 12px;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;">Aqua-sports</div>
          <h1 style="margin:18px 0 0;font-size:30px;line-height:1.12;color:#ffffff;">${escapeHtml(title)}</h1>
          <p style="margin:12px 0 0;color:rgba(255,255,255,.72);font-size:15px;line-height:1.6;">${escapeHtml(intro)}</p>
        </div>
        <div style="padding:30px;">
          ${content}
        </div>
        <div style="padding:24px 30px 30px;border-top:1px solid #DCEAEA;">
          <p style="margin:0;color:#5E7274;font-size:13px;line-height:1.6;">
            Esthetic Diamonds & Spa<br/>
            Hôtel Saint-Georges, Rue Gratien Parize, 97120 Saint-Claude<br/>
            09 74 56 43 36
          </p>
        </div>
      </div>
    </div>
  </div>`;
}

function row(label: string, value: unknown) {
  return `
    <tr>
      <td style="padding:11px 0;color:#5E7274;font-size:14px;border-bottom:1px solid #E9F7F7;">${escapeHtml(label)}</td>
      <td style="padding:11px 0;color:#071B1D;font-size:14px;font-weight:700;text-align:right;border-bottom:1px solid #E9F7F7;">${escapeHtml(value)}</td>
    </tr>`;
}

function classTable(payload: AquaSportNotificationPayload) {
  return `
    <table style="width:100%;border-collapse:collapse;">
      ${row("Séance", payload.classTitle)}
      ${row("Activité", payload.serviceName)}
      ${row("Date", payload.dateLabel)}
      ${row("Heure", payload.timeLabel)}
      ${payload.endTimeLabel ? row("Fin", payload.endTimeLabel) : ""}
      ${row("Coach", payload.coachName || "À confirmer")}
    </table>`;
}

export function aquasportClassCancelledEmail(payload: AquaSportNotificationPayload) {
  return {
    subject: `Séance Aqua-sports annulée — ${payload.classTitle}`,
    html: shell(
      "Votre séance Aqua-sports est annulée.",
      `Bonjour ${payload.clientFirstName || ""}, la séance suivante a été annulée par l’équipe Esthetic Diamonds & Spa.`,
      `
      ${classTable(payload)}
      ${
        payload.reason
          ? `<div style="margin-top:22px;background:#F2FAFA;border-radius:20px;padding:18px;"><p style="margin:0;color:#071B1D;font-size:14px;line-height:1.65;"><strong>Raison :</strong><br/>${escapeHtml(payload.reason)}</p></div>`
          : ""
      }
      <div style="margin-top:22px;background:#F2FAFA;border-radius:20px;padding:18px;">
        <p style="margin:0;color:#071B1D;font-size:14px;line-height:1.65;">
          L’équipe vous contactera si un report ou une alternative est proposée.
        </p>
      </div>`
    )
  };
}

export function aquasportClassUpdatedEmail(payload: AquaSportNotificationPayload) {
  return {
    subject: `Séance Aqua-sports modifiée — ${payload.classTitle}`,
    html: shell(
      "Votre séance Aqua-sports a été modifiée.",
      `Bonjour ${payload.clientFirstName || ""}, l’horaire ou les informations de votre séance ont été mis à jour.`,
      `
      <table style="width:100%;border-collapse:collapse;">
        ${row("Séance", payload.classTitle)}
        ${row("Ancienne date", payload.oldDateLabel || "Non renseignée")}
        ${row("Ancienne heure", payload.oldTimeLabel || "Non renseignée")}
        ${row("Nouvelle date", payload.dateLabel)}
        ${row("Nouvelle heure", payload.timeLabel)}
        ${payload.endTimeLabel ? row("Fin", payload.endTimeLabel) : ""}
        ${row("Coach", payload.coachName || "À confirmer")}
      </table>
      ${
        payload.instructions
          ? `<div style="margin-top:22px;background:#F2FAFA;border-radius:20px;padding:18px;"><p style="margin:0;color:#071B1D;font-size:14px;line-height:1.65;"><strong>Consignes :</strong><br/>${escapeHtml(payload.instructions)}</p></div>`
          : ""
      }
      ${
        payload.managementUrl
          ? `<a href="${escapeHtml(payload.managementUrl)}" style="display:inline-block;margin-top:18px;background:#00D7D5;color:#031113;text-decoration:none;font-weight:700;border-radius:999px;padding:12px 18px;">Gérer ma réservation</a>`
          : ""
      }`
    )
  };
}

export function aquasportWaitlistPlaceAvailableEmail(payload: AquaSportNotificationPayload) {
  return {
    subject: `Une place peut être disponible — ${payload.classTitle}`,
    html: shell(
      "Une place peut être disponible.",
      `Bonjour ${payload.clientFirstName || ""}, une place peut s’être libérée sur une séance Aqua-sports que vous suiviez en liste d’attente.`,
      `
      ${classTable(payload)}
      <div style="margin-top:22px;background:#F2FAFA;border-radius:20px;padding:18px;">
        <p style="margin:0;color:#071B1D;font-size:14px;line-height:1.65;">
          Merci de contacter rapidement l’équipe Esthetic Diamonds & Spa pour confirmer votre inscription. La place n’est pas garantie tant que l’équipe ne l’a pas validée.
        </p>
      </div>`
    )
  };
}

export function internalAquasportNotificationEmail(payload: {
  title: string;
  message: string;
  classTitle: string;
  dateLabel: string;
  timeLabel: string;
  recipientsCount?: number;
}) {
  return {
    subject: payload.title,
    html: shell(
      payload.title,
      payload.message,
      `
      <table style="width:100%;border-collapse:collapse;">
        ${row("Séance", payload.classTitle)}
        ${row("Date", payload.dateLabel)}
        ${row("Heure", payload.timeLabel)}
        ${row("Destinataires", payload.recipientsCount ?? 0)}
      </table>`
    )
  };
}
