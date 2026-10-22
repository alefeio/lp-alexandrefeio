import { createHmac } from "node:crypto";
import { rateLimitWindowBucket } from "@/lib/landing-page/rate-limit/durable";

/** Rótulo técnico do endereço, só para o HMAC. Não é gravado nem devolvido. */
export function clientAddressLabel(headers: { get(name: string): string | null }): string {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "";
  const raw = forwarded || headers.get("x-real-ip")?.trim() || "absent";
  return raw.toLowerCase().replace(/^\[|\]$/g, "").slice(0, 80);
}

/**
 * Chave de abuso de uma janela. Muda com o tempo, então não identifica o visitante depois.
 * Não entra em analytics, sessão, lead nem resposta pública.
 */
export function landingPageAbuseKey(input: {
  secret: string;
  address: string;
  namespace: string;
  now: number;
  windowSeconds: number;
}): string {
  const bucket = rateLimitWindowBucket(input.now, input.windowSeconds);
  return createHmac("sha256", input.secret)
    .update(`${input.address}\n${input.namespace}\n${bucket}`)
    .digest("hex");
}
