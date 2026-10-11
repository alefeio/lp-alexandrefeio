import { siteConfig } from "@/data/site-config";

export function purchaseEmail(input: { items: string[]; totalLabel: string; learnUrl: string }) {
  const subject = "Compra confirmada — Alexandre Feio";
  const lines = input.items.map((item) => `- ${item}`);
  const text = [
    "Sua compra foi confirmada.",
    "",
    ...lines,
    "",
    `Total: ${input.totalLabel}`,
    "",
    `Continuar aprendendo: ${input.learnUrl}`,
    "",
    siteConfig.name,
  ].join("\n");
  const htmlItems = input.items.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
  const html = `<!doctype html><html lang="pt-BR"><body style="margin:0;padding:24px;background:#f8fafc;color:#0f172a;font-family:Arial,Helvetica,sans-serif;line-height:1.6"><div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;padding:32px"><p style="margin:0 0 16px">Sua compra foi confirmada.</p><ul style="margin:0 0 16px;padding-left:18px">${htmlItems}</ul><p style="margin:0 0 16px">Total: ${escapeHtml(input.totalLabel)}</p><p style="margin:0"><a href="${escapeHtml(input.learnUrl)}" style="color:#1e5eff">Continuar aprendendo</a></p></div></body></html>`;
  return { subject, text, html };
}

function escapeHtml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

type PurchaseSender = (input: { to: string; items: string[]; totalLabel: string; learnUrl: string }) => Promise<void>;

let purchaseSenderOverride: PurchaseSender | null = null;

/** Só os testes substituem o envio. Produção continua no Resend. */
export function setPurchaseEmailSenderForTests(sender: PurchaseSender | null) {
  purchaseSenderOverride = sender;
}

export async function deliverPurchaseEmail(input: { to: string; items: string[]; totalLabel: string; learnUrl: string }) {
  if (purchaseSenderOverride) return purchaseSenderOverride(input);
  return sendPurchaseEmail(input);
}

export async function sendPurchaseEmail(input: { to: string; items: string[]; totalLabel: string; learnUrl: string }) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.CONTACT_FROM_EMAIL;
  const replyTo = process.env.CONTACT_REPLY_TO_EMAIL;
  if (!apiKey || !from || !replyTo) throw new Error("EMAIL_NOT_CONFIGURED");
  const { Resend } = await import("resend");
  const message = purchaseEmail(input);
  const { error } = await new Resend(apiKey).emails.send({
    from,
    to: [input.to],
    replyTo,
    subject: message.subject,
    html: message.html,
    text: message.text,
  });
  if (error) throw new Error("EMAIL_SEND_FAILED");
}
