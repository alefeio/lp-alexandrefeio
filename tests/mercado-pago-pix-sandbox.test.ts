import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { config as loadEnv } from "dotenv";
import test from "node:test";
import {
  hasPresentablePix,
  readPix,
  readProviderPayment,
  sanitizeProviderDiagnosticToken,
} from "../src/lib/commerce/provider";

/**
 * Sandbox Pix da Orders API com valores pré-definidos da documentação oficial.
 * Não usa Production. Não altera pedidos reais.
 * Ativar: MP_PIX_SANDBOX_TEST=1 + MERCADO_PAGO_ENV=test + Access Token de teste.
 * Docs: https://www.mercadopago.com.br/developers/pt/docs/checkout-api-orders/integration-test/pix
 */
loadEnv({ path: ".env.local" });

const enabled = process.env.MP_PIX_SANDBOX_TEST === "1";

test("sandbox Pix Orders API: APRO, consulta, idempotência e parser seguro", { skip: !enabled }, async () => {
  assert.notEqual((process.env.MERCADO_PAGO_ENV ?? "").toLowerCase(), "production");
  assert.notEqual((process.env.VERCEL_ENV ?? "").toLowerCase(), "production");
  assert.notEqual((process.env.DATABASE_ENV ?? "").toLowerCase(), "production");
  assert.notEqual(process.env.COMMERCE_PRODUCTION_READY, "true");

  const accessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN?.trim() ?? "";
  assert.ok(accessToken.startsWith("APP_USR"), "Access Token de teste ausente ou inválido");
  assert.equal(process.env.MERCADO_PAGO_ENV, "test");

  const externalReference = `pix-sandbox-${randomUUID()}`;
  const idempotencyKey = randomUUID();
  const body = {
    type: "online",
    processing_mode: "automatic",
    external_reference: externalReference,
    total_amount: "50.00",
    payer: {
      email: "test_payer@example.com",
      first_name: "APRO",
    },
    transactions: {
      payments: [
        {
          amount: "50.00",
          payment_method: {
            id: "pix",
            type: "bank_transfer",
          },
        },
      ],
    },
  };

  async function createOrder(key: string) {
    const response = await fetch("https://api.mercadopago.com/v1/orders", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "X-Idempotency-Key": key,
      },
      body: JSON.stringify(body),
    });
    const payload = await response.json().catch(() => null);
    return { response, payload };
  }

  const first = await createOrder(idempotencyKey);
  assert.ok(first.response.ok, `criação Pix sandbox falhou: HTTP ${first.response.status}`);
  const view = readProviderPayment(first.payload);
  assert.ok(view);
  assert.equal(view.externalReference, externalReference);
  assert.equal(view.amountCents, 5000);
  assert.equal(view.status, "pending");
  assert.equal(sanitizeProviderDiagnosticToken(view.statusDetail), "waiting_transfer");

  const pix = readPix(first.payload);
  assert.ok(hasPresentablePix(pix), "sandbox deve devolver ao menos qr_code ou ticket_url");
  if (pix?.ticketUrl) {
    assert.match(pix.ticketUrl, /^https:\/\/(www\.)?mercadopago\.com(\.br)?\//);
  }

  const lookupResponse = await fetch(`https://api.mercadopago.com/v1/orders/${encodeURIComponent(view.id)}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  assert.ok(lookupResponse.ok, `consulta Pix sandbox falhou: HTTP ${lookupResponse.status}`);
  const lookupPayload = await lookupResponse.json().catch(() => null);
  const lookup = readProviderPayment(lookupPayload);
  assert.ok(lookup);
  assert.equal(lookup.id, view.id);
  assert.equal(lookup.externalReference, externalReference);
  // A documentação indica atualização automática para aprovado após APRO; aceita pending ou approved.
  assert.ok(lookup.status === "pending" || lookup.status === "approved" || lookup.status === "in_process");

  const second = await createOrder(idempotencyKey);
  assert.ok(second.response.ok || second.response.status === 200);
  const secondView = readProviderPayment(second.payload);
  assert.ok(secondView);
  assert.equal(secondView.id, view.id, "mesma X-Idempotency-Key deve reutilizar a order");

  // Sem DB compartilhado: a correspondência Order/Payment/Entitlement fica na suíte isolada.
  assert.equal(typeof view.id, "string");
  assert.ok(view.id.startsWith("ORD") || view.id.length > 8);
});
