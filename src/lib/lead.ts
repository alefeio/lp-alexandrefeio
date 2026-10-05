import { leadObjectives } from "../data/lead-objectives";
import { siteConfig } from "../data/site-config";
import { visitorWhatsAppUrl } from "./contact";

const NAME_MAX = 80;
const COMPANY_MAX = 120;
const WHATSAPP_MAX = 32;
const OBJECTIVE_MAX = 40;
const EXTRA_MAX = 200;
const MIN_FILL_MS = 1000;

export type LeadField = "name" | "company" | "whatsapp" | "objective";
export type LeadErrors = Partial<Record<LeadField, string>>;

export interface LeadInput {
  name: string;
  company: string;
  whatsapp: string;
  objective: string;
  extra: string;
  startedAt: number;
}

export interface PreparedLead {
  name: string;
  company: string;
  whatsapp: string;
  digits: string;
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

export async function deliverLeadEmail(
  email: LeadEmail,
  send: (email: LeadEmail) => Promise<{ name: string; statusCode: number | null } | null>,
): Promise<"sent" | "failed"> {
  try {
    const error = await send(email);
    return error ? "failed" : "sent";
  } catch (error) {
    const name = error instanceof Error ? error.name : "Error";
    console.error("contact form send failed", { name });
    return "failed";
  }
}

export function validateLead(values: Pick<LeadInput, "name" | "company" | "whatsapp" | "objective">): LeadErrors {
  const errors: LeadErrors = {};
  const name = values.name.trim();
  const company = values.company.trim();
  const digits = values.whatsapp.replace(/\D/g, "");

  if (name.length < 2 || name.length > NAME_MAX) {
    errors.name = "Informe seu nome.";
  }

  if (company.length < 2 || company.length > COMPANY_MAX) {
    errors.company = "Informe a empresa.";
  }

  if (digits.length < 10 || digits.length > 13) {
    errors.whatsapp = "Informe um WhatsApp válido, com DDD.";
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
      name: input.name.trim(),
      company: input.company.trim(),
      whatsapp: input.whatsapp.trim(),
      digits: input.whatsapp.replace(/\D/g, ""),
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
    ["Interesse", lead.interest],
    ["Origem", origin],
  ];

  const text = [
    "NOVO CONTATO PELO SITE",
    "",
    ...rows.map(([label, value]) => `${label}:\n${value}`),
    "",
    whatsappHref ? `Conversar no WhatsApp:\n${whatsappHref}` : "",
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
    ? `<p style="margin:24px 0 0"><a href="${escapeHtml(whatsappHref)}">Conversar no WhatsApp</a></p>`
    : "";

  const html = `<!doctype html><html lang="pt-BR"><body style="margin:0;padding:24px;background:#f8fafc;color:#0f172a;font-family:Georgia,serif;line-height:1.5"><div style="max-width:560px;margin:0 auto;background:#ffffff;padding:32px"><p style="margin:0 0 24px;font-family:sans-serif;font-size:12px;letter-spacing:0.08em">NOVO CONTATO PELO SITE</p>${htmlRows}${whatsappHtml}</div></body></html>`;

  return {
    subject: `Novo contato pelo site — ${subjectName}`.slice(0, 180),
    html,
    text,
  };
}
