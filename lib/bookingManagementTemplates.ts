type BasePayload = {
  bookingReference: string;
  clientFirstName: string;
  clientLastName: string;
  clientEmail: string;
  clientPhone: string;
  serviceName: string;
  dateLabel: string;
  timeLabel: string;
  employeeName?: string | null;
  reason?: string | null;
  requestedDate?: string | null;
  requestedTime?: string | null;
  message?: string | null;
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
    <div style="max-width:640px;margin:0 auto;padding:32px 18px;">
      <div style="background:#ffffff;border:1px solid #DCEAEA;border-radius:28px;overflow:hidden;box-shadow:0 18px 48px rgba(3,17,19,.08);">
        <div style="background:linear-gradient(135deg,#071B1D,#07383A);padding:30px;color:#ffffff;">
          <div style="display:inline-block;background:rgba(0,215,213,.15);border:1px solid rgba(0,215,213,.35);color:#00D7D5;border-radius:999px;padding:7px 12px;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;">Esthetic Diamonds & Spa</div>
          <h1 style="margin:18px 0 0;font-size:30px;line-height:1.12;color:#ffffff;">${escapeHtml(title)}</h1>
          <p style="margin:12px 0 0;color:rgba(255,255,255,.72);font-size:15px;line-height:1.6;">${escapeHtml(intro)}</p>
        </div>
        <div style="padding:30px;">
          ${content}
        </div>
        <div style="padding:24px 30px 30px;border-top:1px solid #DCEAEA;">
          <p style="margin:0;color:#5E7274;font-size:13px;line-height:1.6;">
            Hôtel Saint-Georges, Rue Gratien Parize, 97120 Saint-Claude<br/>
            09 74 56 43 36
          </p>
        </div>
      </div>
    </div>
  </div>`;
}

function table(payload: BasePayload) {
  return `
    <table style="width:100%;border-collapse:collapse;">
      ${row("Référence", payload.bookingReference)}
      ${row("Client", `${payload.clientFirstName} ${payload.clientLastName}`)}
      ${row("Téléphone", payload.clientPhone)}
      ${row("E-mail", payload.clientEmail)}
      ${row("Prestation", payload.serviceName)}
      ${row("Date", payload.dateLabel)}
      ${row("Heure", payload.timeLabel)}
      ${row("Employé", payload.employeeName || "Attribution automatique")}
    </table>`;
}

function row(label: string, value: unknown) {
  return `
    <tr>
      <td style="padding:11px 0;color:#5E7274;font-size:14px;border-bottom:1px solid #E9F7F7;">${escapeHtml(label)}</td>
      <td style="padding:11px 0;color:#071B1D;font-size:14px;font-weight:700;text-align:right;border-bottom:1px solid #E9F7F7;">${escapeHtml(value)}</td>
    </tr>`;
}

export function customerCancellationEmail(payload: BasePayload) {
  return {
    subject: "Votre rendez-vous Esthetic Diamonds & Spa a été annulé",
    html: shell(
      "Votre rendez-vous a été annulé.",
      `Bonjour ${payload.clientFirstName}, votre annulation a bien été prise en compte.`,
      `
      ${table(payload)}
      <div style="margin-top:24px;background:#F2FAFA;border-radius:20px;padding:18px;">
        <p style="margin:0;color:#071B1D;font-size:14px;line-height:1.65;">
          Le créneau est désormais libéré. Vous pouvez reprendre rendez-vous depuis la plateforme de réservation.
        </p>
      </div>`
    )
  };
}

export function internalCancellationEmail(payload: BasePayload) {
  return {
    subject: `Annulation client — ${payload.serviceName}`,
    html: shell(
      "Annulation client.",
      "Un client vient d’annuler son rendez-vous depuis son lien de gestion.",
      `
      ${table(payload)}
      ${
        payload.reason
          ? `<div style="margin-top:24px;background:#F2FAFA;border-radius:20px;padding:18px;"><p style="margin:0;color:#071B1D;font-size:14px;line-height:1.65;"><strong>Raison :</strong><br/>${escapeHtml(payload.reason)}</p></div>`
          : ""
      }`
    )
  };
}

export function internalModificationRequestEmail(payload: BasePayload) {
  return {
    subject: `Demande de modification — ${payload.serviceName}`,
    html: shell(
      "Demande de modification.",
      "Un client souhaite modifier son rendez-vous. L’équipe doit valider manuellement la demande.",
      `
      ${table(payload)}
      <div style="margin-top:24px;background:#F2FAFA;border-radius:20px;padding:18px;">
        <p style="margin:0;color:#071B1D;font-size:14px;line-height:1.65;">
          <strong>Nouvelle date souhaitée :</strong> ${escapeHtml(payload.requestedDate || "Non renseignée")}<br/>
          <strong>Nouvel horaire souhaité :</strong> ${escapeHtml(payload.requestedTime || "Non renseigné")}<br/>
          <strong>Message client :</strong><br/>${escapeHtml(payload.message || "Aucun message")}
        </p>
      </div>`
    )
  };
}

export function customerModificationRequestEmail(payload: BasePayload) {
  return {
    subject: "Votre demande de modification a bien été reçue",
    html: shell(
      "Votre demande a bien été reçue.",
      `Bonjour ${payload.clientFirstName}, l’équipe Esthetic Diamonds & Spa reviendra vers vous pour confirmer ou proposer un autre créneau.`,
      `
      ${table(payload)}
      <div style="margin-top:24px;background:#F2FAFA;border-radius:20px;padding:18px;">
        <p style="margin:0;color:#071B1D;font-size:14px;line-height:1.65;">
          Votre rendez-vous actuel reste confirmé tant que l’équipe n’a pas validé la modification.
        </p>
      </div>`
    )
  };
}
