import { Resend } from "resend";
import { siteConfig } from "@/data/site-config";

type AuthEmail = {
  subject: string;
  html: string;
  text: string;
};

function shell(body: string): string {
  return `<!doctype html><html lang="pt-BR"><body style="margin:0;padding:24px;background:#f8fafc;color:#0f172a;font-family:Arial,Helvetica,sans-serif;line-height:1.6"><div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;padding:32px"><p style="margin:0 0 24px;width:40px;height:3px;background:#1e5eff"></p>${body}<p style="margin:24px 0 0;color:#5b6472">${siteConfig.name}<br>Tráfego Pago + Estrutura de Conversão</p></div></body></html>`;
}

export function verificationEmail(url: string): AuthEmail {
  return {
    subject: "Confirme seu e-mail — Alexandre Feio",
    text: `Confirme seu e-mail para usar a conta.\n\n${url}\n\nSe você não criou esta conta, ignore esta mensagem.\n\n${siteConfig.name}`,
    html: shell(
      `<p style="margin:0 0 16px">Confirme seu e-mail para usar a conta.</p><p style="margin:0 0 16px"><a href="${url}" style="color:#1e5eff">Confirmar e-mail</a></p><p style="margin:0;color:#5b6472">Se você não criou esta conta, ignore esta mensagem.</p>`,
    ),
  };
}

export function passwordResetEmail(url: string): AuthEmail {
  return {
    subject: "Redefinir senha — Alexandre Feio",
    text: `Use o link abaixo para escolher uma nova senha.\n\n${url}\n\nSe você não pediu isso, ignore esta mensagem.\n\n${siteConfig.name}`,
    html: shell(
      `<p style="margin:0 0 16px">Use o link abaixo para escolher uma nova senha.</p><p style="margin:0 0 16px"><a href="${url}" style="color:#1e5eff">Redefinir senha</a></p><p style="margin:0;color:#5b6472">Se você não pediu isso, ignore esta mensagem.</p>`,
    ),
  };
}

export async function sendAuthEmail(input: AuthEmail & { to: string }): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.CONTACT_FROM_EMAIL;
  const replyTo = process.env.CONTACT_REPLY_TO_EMAIL;

  if (!apiKey || !from || !replyTo) {
    console.error("auth email: missing email configuration");
    throw new Error("EMAIL_NOT_CONFIGURED");
  }

  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({
    from,
    to: [input.to],
    replyTo,
    subject: input.subject,
    html: input.html,
    text: input.text,
  });

  if (error) {
    console.error("auth email failed", { name: error.name, statusCode: error.statusCode });
    throw new Error(error.statusCode === 401 || error.statusCode === 403 ? "EMAIL_NOT_CONFIGURED" : "EMAIL_SEND_FAILED");
  }
}
