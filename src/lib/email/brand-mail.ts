import { siteConfig } from "@/data/site-config";

const NAVY = "#0B1220";
const BLUE = "#1E5EFF";
const CORAL = "#FF7A45";
const TEXT = "#0F172A";
const CANVAS = "#F8FAFC";

export const BRAND_EMAIL_SIGNATURE = "Aprendizado e estratégia digital na prática.";

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function safeHttpUrl(value: string): string | null {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

export type TransactionalEmailInput = {
  preheader: string;
  title: string;
  paragraphs: string[];
  cta?: { label: string; url: string };
  note?: string;
  extraHtml?: string;
};

export function transactionalEmail(input: TransactionalEmailInput): { html: string; text: string } {
  const logoUrl = `${siteConfig.url}/logoAF_vert.png`;
  const ctaUrl = input.cta ? safeHttpUrl(input.cta.url) : null;
  const paragraphs = input.paragraphs.map((paragraph) => `<p style="margin:0 0 16px;font-size:16px;line-height:1.6;">${escapeHtml(paragraph)}</p>`).join("");
  const button = input.cta && ctaUrl
    ? `<table role="presentation" cellspacing="0" cellpadding="0" style="margin:8px 0 16px;"><tr><td style="background:${BLUE};border-radius:6px;"><a href="${escapeHtml(ctaUrl)}" style="display:inline-block;padding:12px 20px;color:#ffffff;font-size:16px;font-weight:bold;text-decoration:none;">${escapeHtml(input.cta.label)}</a></td></tr></table><p style="margin:0 0 8px;font-size:13px;line-height:1.5;">Se o botão não funcionar, copie e cole este endereço no navegador:</p><p style="margin:0 0 16px;font-size:13px;line-height:1.5;word-break:break-all;">${escapeHtml(ctaUrl)}</p>`
    : "";
  const note = input.note ? `<p style="margin:0;font-size:14px;line-height:1.6;">${escapeHtml(input.note)}</p>` : "";

  const html = `<!doctype html><html lang="pt-BR"><body style="margin:0;padding:0;background:${CANVAS};color:${TEXT};font-family:Arial,Helvetica,sans-serif;">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${escapeHtml(input.preheader)}</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${CANVAS};"><tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border:1px solid #e2e8f0;">
<tr><td style="background:${NAVY};padding:20px 28px;">
<p style="margin:0;color:#ffffff;font-size:20px;font-weight:bold;line-height:1.2;">${escapeHtml(siteConfig.name)}</p>
</td></tr>
<tr><td style="height:4px;background:${CORAL};font-size:0;line-height:0;">&nbsp;</td></tr>
<tr><td style="padding:28px;color:${TEXT};">
<img src="${escapeHtml(logoUrl)}" alt="" height="28" style="display:block;height:28px;width:auto;border:0;margin:0 0 16px;">
<h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;">${escapeHtml(input.title)}</h1>
${paragraphs}
${input.extraHtml ?? ""}
${button}
${note}
</td></tr>
<tr><td style="padding:0 28px 24px;color:${TEXT};font-size:13px;line-height:1.5;">
${escapeHtml(BRAND_EMAIL_SIGNATURE)}<br>
<a href="${escapeHtml(siteConfig.url)}" style="color:${BLUE};">${escapeHtml(siteConfig.url.replace(/^https?:\/\//, ""))}</a>
</td></tr>
</table>
</td></tr></table>
</body></html>`;

  const text = [
    siteConfig.name,
    "",
    input.title,
    "",
    ...input.paragraphs,
    "",
    ...(input.cta && ctaUrl ? [input.cta.label, ctaUrl, ""] : []),
    ...(input.note ? [input.note, ""] : []),
    BRAND_EMAIL_SIGNATURE,
    siteConfig.url.replace(/^https?:\/\//, ""),
  ].join("\n");

  return { html, text };
}
