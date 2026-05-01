type ReminderPayload = {
  clientFirstName: string;
  serviceName: string;
  dateLabel: string;
  timeLabel: string;
  durationMinutes: number;
  bookingReference: string;
  reminderType: "24h" | "2h";
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

export function customerReminderEmail(payload: ReminderPayload) {
  const timingText =
    payload.reminderType === "24h"
      ? "demain"
      : "dans environ 2 heures";

  const subject =
    payload.reminderType === "24h"
      ? `Rappel : votre rendez-vous Esthetic Diamonds & Spa est prévu demain`
      : `Rappel : votre rendez-vous Esthetic Diamonds & Spa est prévu bientôt`;

  const html = `
  <div style="margin:0;padding:0;background:#F7FBFB;font-family:Arial,Helvetica,sans-serif;color:#071B1D;">
    <div style="max-width:640px;margin:0 auto;padding:32px 18px;">
      <div style="background:#ffffff;border:1px solid #DCEAEA;border-radius:28px;overflow:hidden;box-shadow:0 18px 48px rgba(3,17,19,.08);">
        <div style="background:linear-gradient(135deg,#071B1D,#07383A);padding:30px;color:#ffffff;">
          <div style="display:inline-block;background:rgba(0,215,213,.15);border:1px solid rgba(0,215,213,.35);color:#00D7D5;border-radius:999px;padding:7px 12px;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;">Rappel rendez-vous</div>
          <h1 style="margin:18px 0 0;font-size:30px;line-height:1.12;color:#ffffff;">Votre rendez-vous est prévu ${escapeHtml(timingText)}.</h1>
          <p style="margin:12px 0 0;color:rgba(255,255,255,.72);font-size:15px;line-height:1.6;">Bonjour ${escapeHtml(payload.clientFirstName)}, voici un rappel de votre réservation chez Esthetic Diamonds & Spa.</p>
        </div>
        <div style="padding:30px;">
          <table style="width:100%;border-collapse:collapse;">
            <tr>
              <td style="padding:11px 0;color:#5E7274;font-size:14px;border-bottom:1px solid #E9F7F7;">Référence</td>
              <td style="padding:11px 0;color:#071B1D;font-size:14px;font-weight:700;text-align:right;border-bottom:1px solid #E9F7F7;">${escapeHtml(payload.bookingReference)}</td>
            </tr>
            <tr>
              <td style="padding:11px 0;color:#5E7274;font-size:14px;border-bottom:1px solid #E9F7F7;">Prestation</td>
              <td style="padding:11px 0;color:#071B1D;font-size:14px;font-weight:700;text-align:right;border-bottom:1px solid #E9F7F7;">${escapeHtml(payload.serviceName)}</td>
            </tr>
            <tr>
              <td style="padding:11px 0;color:#5E7274;font-size:14px;border-bottom:1px solid #E9F7F7;">Date</td>
              <td style="padding:11px 0;color:#071B1D;font-size:14px;font-weight:700;text-align:right;border-bottom:1px solid #E9F7F7;">${escapeHtml(payload.dateLabel)}</td>
            </tr>
            <tr>
              <td style="padding:11px 0;color:#5E7274;font-size:14px;border-bottom:1px solid #E9F7F7;">Heure</td>
              <td style="padding:11px 0;color:#071B1D;font-size:14px;font-weight:700;text-align:right;border-bottom:1px solid #E9F7F7;">${escapeHtml(payload.timeLabel)}</td>
            </tr>
            <tr>
              <td style="padding:11px 0;color:#5E7274;font-size:14px;border-bottom:1px solid #E9F7F7;">Durée</td>
              <td style="padding:11px 0;color:#071B1D;font-size:14px;font-weight:700;text-align:right;border-bottom:1px solid #E9F7F7;">${escapeHtml(payload.durationMinutes)} min</td>
            </tr>
          </table>
          <div style="margin-top:24px;background:#F2FAFA;border-radius:20px;padding:18px;">
            <p style="margin:0;color:#071B1D;font-size:14px;line-height:1.65;">
              Merci de prévenir l’équipe en cas d’empêchement. Pensez à arriver quelques minutes avant votre rendez-vous.
            </p>
            ${
              payload.managementUrl
                ? `<a href="${escapeHtml(payload.managementUrl)}" style="display:inline-block;margin-top:16px;background:#00D7D5;color:#031113;text-decoration:none;font-weight:700;border-radius:999px;padding:12px 18px;">Gérer ma réservation</a>`
                : ""
            }
          </div>
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

  return {
    subject,
    html
  };
}
