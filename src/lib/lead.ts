import { leadObjectives } from "../data/lead-objectives";
import { siteConfig } from "../data/site-config";
import { visitorWhatsAppUrl } from "./contact";

const NAME_MAX = 80;
const COMPANY_MAX = 120;
const WHATSAPP_MAX = 32;
const EMAIL_MAX = 254;
const OBJECTIVE_MAX = 40;
const EXTRA_MAX = 200;
const MIN_FILL_MS = 1000;

export type LeadField = "name" | "company" | "whatsapp" | "email" | "objective";
export type LeadErrors = Partial<Record<LeadField, string>>;

export interface LeadInput {
  name: string;
  company: string;
  whatsapp: string;
  email: string;
  objective: string;
  extra: string;
  startedAt: number;
}

export interface PreparedLead {
  name: string;
  company: string;
  whatsapp: string;
  digits: string;
  email: string;
  interest: string;
}

export type PrepareResult =
  | { ok: true; lead: PreparedLead }
  | { ok: false; reason: "invalid"; errors: LeadErrors }
  | { ok: false; reason: "rejected" };

export interface LeadEmail {
  subject: string;
  html: string;
  text: string;
}

export type SendFailure = { name: string; statusCode: number | null };

export interface OutboundEmail extends LeadEmail {
  to: string;
  replyTo: string;
}

export type DispatchResult =
  | { ok: true; confirmation: "sent" | "failed" }
  | { ok: false; stage: "admin" };

export async function deliverLeadEmail(
  email: LeadEmail,
  stage: "admin" | "confirmation",
  send: (email: LeadEmail) => Promise<SendFailure | null>,
): Promise<"sent" | "failed"> {
  try {
    const error = await send(email);
    if (!error) return "sent";
    console.error("contact form send failed", { stage, name: error.name, statusCode: error.statusCode });
    return "failed";
  } catch (error) {
    const name = error instanceof Error ? error.name : "Error";
    console.error("contact form send failed", { stage, name });
    return "failed";
  }
}

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function isValidEmail(value: string): boolean {
  if (value.length < 3 || value.length > EMAIL_MAX) return false;
  if (/[\s<>]/.test(value)) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function validateLead(values: Pick<LeadInput, "name" | "company" | "whatsapp" | "email" | "objective">): LeadErrors {
  const errors: LeadErrors = {};
  const name = values.name.trim();
  const company = values.company.trim();
  const digits = values.whatsapp.replace(/\D/g, "");
  const email = normalizeEmail(values.email);

  if (name.length < 2 || name.length > NAME_MAX) {
    errors.name = "Informe seu nome.";
  }

  if (company.length < 2 || company.length > COMPANY_MAX) {
    errors.company = "Informe a empresa.";
  }

  if (digits.length < 10 || digits.length > 13) {
    errors.whatsapp = "Informe um WhatsApp válido, com DDD.";
  }

  if (!isValidEmail(email)) {
    errors.email = "Informe um e-mail válido.";
  }

  if (!leadObjectives.some((objective) => objective.value === values.objective)) {
    errors.objective = "Selecione o principal objetivo.";
  }

  return errors;
}

export function prepareLead(input: LeadInput, now = Date.now()): PrepareResult {
  if (typeof input.extra === "string" && input.extra.trim().length > 0) {
    return { ok: false, reason: "rejected" };
  }

  if (!Number.isFinite(input.startedAt) || input.startedAt <= 0 || now - input.startedAt < MIN_FILL_MS) {
    return { ok: false, reason: "rejected" };
  }

  if (
    input.name.length > NAME_MAX ||
    input.company.length > COMPANY_MAX ||
    input.whatsapp.length > WHATSAPP_MAX ||
    input.email.length > EMAIL_MAX ||
    input.objective.length > OBJECTIVE_MAX ||
    input.extra.length > EXTRA_MAX
  ) {
    return { ok: false, reason: "rejected" };
  }

  const errors = validateLead(input);
  if (Object.keys(errors).length > 0) {
    return { ok: false, reason: "invalid", errors };
  }

  const interest = leadObjectives.find((objective) => objective.value === input.objective)?.label ?? "";

  return {
    ok: true,
    lead: {
      name: singleLine(input.name),
      company: singleLine(input.company),
      whatsapp: singleLine(input.whatsapp),
      digits: input.whatsapp.replace(/\D/g, ""),
      email: normalizeEmail(input.email),
      interest,
    },
  };
}

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function singleLine(value: string): string {
  return value.replace(/[\r\n]+/g, " ").trim();
}

export function buildLeadEmail(lead: PreparedLead): LeadEmail {
  const origin = new URL(siteConfig.url).host;
  const subjectName = singleLine(lead.name || lead.company);
  const whatsappHref = visitorWhatsAppUrl(lead.digits);
  const rows = [
    ["Nome", lead.name],
    ["Empresa", lead.company],
    ["WhatsApp", lead.whatsapp],
    ["E-mail", lead.email],
    ["Interesse", lead.interest],
    ["Origem", origin],
  ];

  const text = [
    "NOVO CONTATO PELO SITE",
    "",
    ...rows.map(([label, value]) => `${label}:\n${value}`),
    "",
    whatsappHref ? `Conversar no WhatsApp:\n${whatsappHref}` : "",
    `Responder por e-mail:\nmailto:${lead.email}`,
  ]
    .filter((line) => line !== "")
    .join("\n");

  const htmlRows = rows
    .map(
      ([label, value]) =>
        `<p style="margin:0 0 16px"><span style="color:#5b6472">${escapeHtml(label)}</span><br><strong>${escapeHtml(value)}</strong></p>`,
    )
    .join("");

  const whatsappHtml = whatsappHref
    ? `<p style="margin:24px 0 0"><a href="${escapeHtml(whatsappHref)}" style="color:#1e5eff">Conversar no WhatsApp</a></p>`
    : "";
  const mailtoHtml = `<p style="margin:12px 0 0"><a href="mailto:${escapeHtml(lead.email)}" style="color:#1e5eff">Responder por e-mail</a></p>`;

  const html = `<!doctype html><html lang="pt-BR"><body style="margin:0;padding:24px;background:#f8fafc;color:#0f172a;font-family:Arial,Helvetica,sans-serif;line-height:1.5"><div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;padding:32px"><p style="margin:0 0 24px;font-size:12px;letter-spacing:0.08em">NOVO CONTATO PELO SITE</p>${htmlRows}${whatsappHtml}${mailtoHtml}</div></body></html>`;

  return {
    subject: `Novo contato pelo site — ${subjectName}`.slice(0, 180),
    html,
    text,
  };
}

export function buildConfirmationEmail(lead: PreparedLead): LeadEmail {
  const origin = new URL(siteConfig.url).host;
  const name = escapeHtml(lead.name);
  const interest = escapeHtml(lead.interest);
  const text = [
    `Olá, ${lead.name}.`,
    "",
    "Recebi seu contato pelo site.",
    "",
    `Você me procurou para falar sobre ${lead.interest}. Vou analisar e retorno pelo WhatsApp ou pelo e-mail informado.`,
    "",
    siteConfig.name,
    "Sites + Tráfego Pago",
    origin,
  ].join("\n");

  const html = `<!doctype html><html lang="pt-BR"><body style="margin:0;padding:24px;background:#f8fafc;color:#0f172a;font-family:Arial,Helvetica,sans-serif;line-height:1.6"><div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;padding:32px"><p style="margin:0 0 24px;width:40px;height:3px;background:#1e5eff"></p><p style="margin:0 0 16px">Olá, ${name}.</p><p style="margin:0 0 16px">Recebi seu contato pelo site.</p><p style="margin:0 0 24px">Você me procurou para falar sobre ${interest}. Vou analisar e retorno pelo WhatsApp ou pelo e-mail informado.</p><p style="margin:0;color:#5b6472">${escapeHtml(siteConfig.name)}<br>Sites + Tráfego Pago<br>${escapeHtml(origin)}</p></div></body></html>`;

  return {
    subject: "Recebi seu contato — Alexandre Feio",
    html,
    text,
  };
}

export async function dispatchLeadEmails(
  lead: PreparedLead,
  routing: { adminTo: string; replyTo: string },
  send: (message: OutboundEmail) => Promise<SendFailure | null>,
): Promise<DispatchResult> {
  const admin = await deliverLeadEmail(buildLeadEmail(lead), "admin", (message) =>
    send({ ...message, to: routing.adminTo, replyTo: lead.email }),
  );
  if (admin === "failed") return { ok: false, stage: "admin" };

  const confirmation = await deliverLeadEmail(buildConfirmationEmail(lead), "confirmation", (message) =>
    send({ ...message, to: lead.email, replyTo: singleLine(routing.replyTo) }),
  );

  return { ok: true, confirmation: confirmation === "sent" ? "sent" : "failed" };
}
