import { CHARGE_API_ORDERS, CHARGE_API_PAYMENTS } from "@/lib/commerce/charge-api";
import { mercadoPagoRuntimeConfig, webhookLiveModeAllowed } from "@/lib/commerce/config";
import { reconcileMercadoPagoPayment } from "@/lib/commerce/apply";
import { verifyMercadoPagoSignature } from "@/lib/commerce/signature";

export async function POST(request: Request) {
  const config = mercadoPagoRuntimeConfig();
  if (!config) return new Response("Pagamento não configurado.", { status: 503 });
  const url = new URL(request.url);
  const body = await request.json().catch(() => null);
  const dataId = url.searchParams.get("data.id") ?? readDataId(body);
  const valid = verifyMercadoPagoSignature({
    secret: config.webhookSecret,
    xSignature: request.headers.get("x-signature"),
    xRequestId: request.headers.get("x-request-id"),
    dataId,
  });
  if (!valid) return new Response("Assinatura inválida.", { status: 401 });
  const type =
    body && typeof body === "object" && "type" in body
      ? String((body as { type?: unknown }).type ?? "")
      : (url.searchParams.get("type") ?? "");
  const liveMode =
    body && typeof body === "object" && "live_mode" in body ? (body as { live_mode?: unknown }).live_mode : null;
  if (!webhookLiveModeAllowed(config.env, liveMode)) return new Response("ok");

  // Orders (cartão / Pix-orders) e Payments (Pix-payments) — nunca confiar só no body; reconcilia via GET.
  if (type === "order") {
    if (!dataId) return new Response("ok");
    await reconcileMercadoPagoPayment(dataId, CHARGE_API_ORDERS);
    return new Response("ok");
  }
  if (type === "payment") {
    if (!dataId) return new Response("ok");
    await reconcileMercadoPagoPayment(dataId, CHARGE_API_PAYMENTS);
    return new Response("ok");
  }
  return new Response("ok");
}

function readDataId(body: unknown): string | null {
  if (!body || typeof body !== "object" || !("data" in body)) return null;
  const data = (body as { data?: { id?: unknown } }).data;
  if (!data || (typeof data.id !== "string" && typeof data.id !== "number")) return null;
  return String(data.id);
}
