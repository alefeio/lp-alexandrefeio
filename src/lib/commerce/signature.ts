import { createHmac, timingSafeEqual } from "node:crypto";

/** Manifest oficial: id;request-id;ts. data.id alfanumérico entra em minúsculas. */
export function verifyMercadoPagoSignature(input: {
  secret: string;
  xSignature: string | null;
  xRequestId: string | null;
  dataId: string | null;
}): boolean {
  if (!input.secret || !input.xSignature || !input.xRequestId || !input.dataId) return false;
  const parts = new Map<string, string>();
  for (const piece of input.xSignature.split(",")) {
    const [key, value] = piece.split("=");
    if (key && value) parts.set(key.trim(), value.trim());
  }
  const ts = parts.get("ts");
  const v1 = parts.get("v1");
  if (!ts || !v1) return false;
  const dataId = /^[a-z0-9]+$/i.test(input.dataId) ? input.dataId.toLowerCase() : input.dataId;
  const manifest = `id:${dataId};request-id:${input.xRequestId};ts:${ts};`;
  const expected = createHmac("sha256", input.secret).update(manifest).digest("hex");
  const left = Buffer.from(expected);
  const right = Buffer.from(v1);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}
