import { mercadoPagoTestConfig } from "@/lib/commerce/config";
import { reconcileMercadoPagoPayment } from "@/lib/commerce/apply";
import { verifyMercadoPagoSignature } from "@/lib/commerce/signature";

export async function POST(request: Request) {
  const config = mercadoPagoTestConfig();
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
  const type = body && typeof body === "object" && "type" in body ? String((body as { type?: unknown }).type ?? "") : url.searchParams.get("type") ?? "";
  if (type && type !== "payment") return new Response("ok");
  if (!dataId) return new Response("ok");
  await reconcileMercadoPagoPayment(dataId);
  return new Response("ok");
}

function readDataId(body: unknown): string | null {
  if (!body || typeof body !== "object" || !("data" in body)) return null;
  const data = (body as { data?: { id?: unknown } }).data;
  if (!data || (typeof data.id !== "string" && typeof data.id !== "number")) return null;
  return String(data.id);
}
