import { escapeHtml, transactionalEmail } from "@/lib/email/brand-mail";

export function purchaseEmail(input: { items: string[]; totalLabel: string; learnUrl: string }) {
  const subject = "Compra confirmada — Alexandre Feio";
  const itemLines = input.items.map((item) => `- ${item}`);
  const extraHtml = `<ul style="margin:0 0 16px;padding-left:18px;">${input.items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul><p style="margin:0 0 16px;font-size:16px;line-height:1.6;">Total: ${escapeHtml(input.totalLabel)}</p>`;
  const body = transactionalEmail({
    preheader: "Sua compra foi confirmada.",
    title: "Compra confirmada",
    paragraphs: ["Sua compra foi confirmada."],
    extraHtml,
    cta: { label: "Continuar aprendendo", url: input.learnUrl },
  });
  const text = ["Sua compra foi confirmada.", "", ...itemLines, "", `Total: ${input.totalLabel}`, "", body.text].join("\n");
  return { subject, text, html: body.html };
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
