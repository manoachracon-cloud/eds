type PaymentPayload = {
  clientFirstName: string;
  bookingReference: string;
  serviceName: string;
  amountLabel: string;
  paymentStatus: string;
};

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function customerPaymentSuccessEmail(payload: PaymentPayload) {
  const html = `
  <div style="margin:0;padding:0;background:#F7FBFB;font-family:Arial,Helvetica,sans-serif;color:#071B1D;">
    <div style="max-width:640px;margin:0 auto;padding:32px 18px;">
      <div style="background:#ffffff;border:1px solid #DCEAEA;border-radius:28px;overflow:hidden;box-shadow:0 18px 48px rgba(3,17,19,.08);">
        <div style="background:linear-gradient(135deg,#071B1D,#07383A);padding:30px;color:#ffffff;">
          <div style="display:inline-block;background:rgba(0,215,213,.15);border:1px solid rgba(0,215,213,.35);color:#00D7D5;border-radius:999px;padding:7px 12px;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;">Paiement confirmé</div>
          <h1 style="margin:18px 0 0;font-size:30px;line-height:1.12;color:#ffffff;">Votre paiement a bien été reçu.</h1>
          <p style="margin:12px 0 0;color:rgba(255,255,255,.72);font-size:15px;line-height:1.6;">Bonjour ${escapeHtml(payload.clientFirstName)}, votre paiement pour votre réservation Esthetic Diamonds & Spa est confirmé.</p>
        </div>
        <div style="padding:30px;">
          <table style="width:100%;border-collapse:collapse;">
            <tr><td style="padding:11px 0;color:#5E7274;font-size:14px;border-bottom:1px solid #E9F7F7;">Référence</td><td style="padding:11px 0;color:#071B1D;font-size:14px;font-weight:700;text-align:right;border-bottom:1px solid #E9F7F7;">${escapeHtml(payload.bookingReference)}</td></tr>
            <tr><td style="padding:11px 0;color:#5E7274;font-size:14px;border-bottom:1px solid #E9F7F7;">Prestation</td><td style="padding:11px 0;color:#071B1D;font-size:14px;font-weight:700;text-align:right;border-bottom:1px solid #E9F7F7;">${escapeHtml(payload.serviceName)}</td></tr>
            <tr><td style="padding:11px 0;color:#5E7274;font-size:14px;border-bottom:1px solid #E9F7F7;">Montant</td><td style="padding:11px 0;color:#071B1D;font-size:14px;font-weight:700;text-align:right;border-bottom:1px solid #E9F7F7;">${escapeHtml(payload.amountLabel)}</td></tr>
          </table>
          <div style="margin-top:24px;background:#F2FAFA;border-radius:20px;padding:18px;">
            <p style="margin:0;color:#071B1D;font-size:14px;line-height:1.65;">Merci pour votre paiement. Votre réservation est bien enregistrée.</p>
          </div>
        </div>
        <div style="padding:24px 30px 30px;border-top:1px solid #DCEAEA;">
          <p style="margin:0;color:#5E7274;font-size:13px;line-height:1.6;">Hôtel Saint-Georges, Rue Gratien Parize, 97120 Saint-Claude<br/>09 74 56 43 36</p>
        </div>
      </div>
    </div>
  </div>`;

  return {
    subject: "Paiement confirmé — Esthetic Diamonds & Spa",
    html
  };
}
