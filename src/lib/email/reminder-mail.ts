import { siteConfig } from "@/data/site-config";

export function reminderEmail(input: { projectName: string; title: string; planUrl: string }) {
  const subject = "Lembrete — revisar sua campanha";
  const text = [
    `Você tem um lembrete no projeto ${input.projectName}.`,
    input.title,
    "",
    `Ver meu plano: ${input.planUrl}`,
    "",
    "Este e-mail não inclui respostas de diagnóstico, valores de orçamento nem notas.",
    "",
    siteConfig.name,
  ].join("\n");
  const html = `<!doctype html><html lang="pt-BR"><body style="margin:0;padding:24px;background:#f8fafc;color:#0f172a;font-family:Arial,Helvetica,sans-serif;line-height:1.6"><div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;padding:32px"><p style="margin:0 0 16px">Você tem um lembrete no projeto ${escapeHtml(input.projectName)}.</p><p style="margin:0 0 16px">${escapeHtml(input.title)}</p><p style="margin:0 0 16px"><a href="${escapeHtml(input.planUrl)}" style="color:#1e5eff">Ver meu plano</a></p><p style="margin:0;color:#5b6472">Este e-mail não inclui respostas de diagnóstico, valores de orçamento nem notas.</p></div></body></html>`;
  return { subject, text, html };
}

function escapeHtml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

export async function sendReminderEmail(input: { to: string; projectName: string; title: string; planUrl: string }) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.CONTACT_FROM_EMAIL;
  const replyTo = process.env.CONTACT_REPLY_TO_EMAIL;
  if (!apiKey || !from || !replyTo) throw new Error("EMAIL_NOT_CONFIGURED");
  const { Resend } = await import("resend");
  const message = reminderEmail(input);
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
