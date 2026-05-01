type GiftCardPayload = {
  code: string;
  amountLabel: string;
  buyerName: string;
  buyerEmail: string;
  recipientName?: string | null;
  recipientEmail?: string | null;
  message?: string | null;
  expiresAtLabel?: string | null;
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
          <div style="display:inline-block;background:rgba(0,215,213,.15);border:1px solid rgba(0,215,213,.35);color:#00D7D5;border-radius:999px;padding:7px 12px;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;">Carte cadeau</div>
          <h1 style="margin:18px 0 0;font-size:32px;line-height:1.12;color:#ffffff;">${escapeHtml(title)}</h1>
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

function giftCardBlock(payload: GiftCardPayload) {
  return `
    <div style="background:linear-gradient(135deg,#F2FAFA,#FFFFFF);border:1px solid #DCEAEA;border-radius:26px;padding:26px;text-align:center;">
      <p style="margin:0;color:#008F91;font-size:12px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;">Montant</p>
      <p style="margin:8px 0 0;color:#071B1D;font-size:40px;font-weight:800;">${escapeHtml(payload.amountLabel)}</p>
      <p style="margin:22px 0 0;color:#5E7274;font-size:12px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;">Code carte cadeau</p>
      <p style="margin:8px 0 0;display:inline-block;background:#071B1D;color:#ffffff;border-radius:16px;padding:14px 18px;font-size:24px;font-weight:800;letter-spacing:.12em;">${escapeHtml(payload.code)}</p>
      ${
        payload.expiresAtLabel
          ? `<p style="margin:18px 0 0;color:#5E7274;font-size:13px;">Valable jusqu’au ${escapeHtml(payload.expiresAtLabel)}</p>`
          : ""
      }
    </div>
    ${
      payload.message
        ? `<div style="margin-top:22px;background:#F2FAFA;border-radius:20px;padding:18px;"><p style="margin:0;color:#071B1D;font-size:14px;line-height:1.65;"><strong>Message :</strong><br/>${escapeHtml(payload.message)}</p></div>`
        : ""
    }
  `;
}

export function giftCardRecipientEmail(payload: GiftCardPayload) {
  const recipient = payload.recipientName || "Bonjour";

  return {
    subject: "Vous avez reçu une carte cadeau Esthetic Diamonds & Spa",
    html: shell(
      "Vous avez reçu une carte cadeau.",
      `${recipient}, une parenthèse de bien-être vous attend chez Esthetic Diamonds & Spa.`,
      giftCardBlock(payload)
    )
  };
}

export function giftCardBuyerConfirmationEmail(payload: GiftCardPayload) {
  return {
    subject: "Votre carte cadeau Esthetic Diamonds & Spa est confirmée",
    html: shell(
      "Votre carte cadeau est confirmée.",
      `Bonjour ${payload.buyerName}, votre achat de carte cadeau est bien confirmé.`,
      `
        ${giftCardBlock(payload)}
        <div style="margin-top:22px;background:#F2FAFA;border-radius:20px;padding:18px;">
          <p style="margin:0;color:#071B1D;font-size:14px;line-height:1.65;">
            Bénéficiaire : ${escapeHtml(payload.recipientName || "Non renseigné")}<br/>
            E-mail bénéficiaire : ${escapeHtml(payload.recipientEmail || "Non renseigné")}
          </p>
        </div>
      `
    )
  };
}
