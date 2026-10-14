import { Resend } from "resend";
import { transactionalEmail } from "@/lib/email/brand-mail";

type AuthEmail = {
  subject: string;
  html: string;
  text: string;
};

export function verificationEmail(url: string): AuthEmail {
  const body = transactionalEmail({
    preheader: "Confirme sua conta para continuar o aprendizado e salvar o progresso.",
    title: "Confirme seu e-mail",
    paragraphs: ["Você criou uma conta para continuar seu aprendizado e salvar seu progresso."],
    cta: { label: "Confirmar meu e-mail", url },
    note: "Este link expira por segurança. Se você não criou esta conta, ignore esta mensagem.",
  });
  return { subject: "Confirme seu e-mail — Alexandre Feio", ...body };
}

export function passwordResetEmail(url: string): AuthEmail {
  const body = transactionalEmail({
    preheader: "Use o link para escolher uma nova senha.",
    title: "Redefina sua senha",
    paragraphs: ["Recebemos um pedido para escolher uma nova senha da sua conta."],
    cta: { label: "Redefinir senha", url },
    note: "Este link expira por segurança. Se você não pediu isso, ignore esta mensagem.",
  });
  return { subject: "Redefina sua senha — Alexandre Feio", ...body };
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
