import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { config as loadEnv } from "dotenv";
import test from "node:test";
import { hasPresentablePix } from "../src/lib/commerce/provider";
import {
  readPixFromPayments,
  readProviderPaymentFromPayments,
} from "../src/lib/commerce/payments-api";

/**
 * Sandbox Payments API Pix (não Orders).
 * Ativar: MP_PAYMENTS_PIX_SANDBOX_TEST=1 + MERCADO_PAGO_ENV=test + Access Token de teste.
 * Não usa Production. Não altera pedidos reais.
 * Docs: https://www.mercadopago.com.br/developers/pt/docs/checkout-api-payments/integration-configuration/integrate-pix
 */
loadEnv({ path: ".env.local" });

const enabled = process.env.MP_PAYMENTS_PIX_SANDBOX_TEST === "1";

test("sandbox Payments API Pix: create, QR, GET, idempotência", { skip: !enabled }, async () => {
  assert.notEqual((process.env.MERCADO_PAGO_ENV ?? "").toLowerCase(), "production");
  assert.notEqual((process.env.VERCEL_ENV ?? "").toLowerCase(), "production");
  assert.notEqual(process.env.COMMERCE_PRODUCTION_READY, "true");

  const accessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN?.trim() ?? "";
  assert.ok(accessToken.startsWith("APP_USR"), "Access Token de teste ausente");
  assert.equal(process.env.MERCADO_PAGO_ENV, "test");

  const externalReference = `pay-pix-sandbox-${randomUUID()}`;
  const idempotencyKey = randomUUID();
  const body = {
    transaction_amount: 1.0,
    description: "Sandbox Pix Payments API",
    payment_method_id: "pix",
    external_reference: externalReference,
    payer: {
      email: "test_user@testuser.com",
    },
  };

  async function create(key: string) {
    const response = await fetch("https://api.mercadopago.com/v1/payments", {
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

  const first = await create(idempotencyKey);
  const firstError =
    first.payload && typeof first.payload === "object" && "message" in first.payload
      ? String((first.payload as { message?: unknown }).message ?? "").slice(0, 120)
      : "";
  assert.ok(
    first.response.ok || first.response.status === 201,
    `criação Pix payments falhou: HTTP ${first.response.status}${firstError ? ` — ${firstError}` : ""}`,
  );
  const view = readProviderPaymentFromPayments(first.payload);
  assert.ok(view);
  assert.equal(view.externalReference, externalReference);
  assert.equal(view.amountCents, 100);
  assert.equal(view.status, "pending");
  assert.equal(view.currency, "BRL");

  const pix = readPixFromPayments(first.payload);
  assert.ok(hasPresentablePix(pix), "sandbox Payments deve devolver qr_code ou ticket_url");

  const lookup = await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(view.id)}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  assert.ok(lookup.ok, `GET payment falhou: HTTP ${lookup.status}`);
  const lookupView = readProviderPaymentFromPayments(await lookup.json().catch(() => null));
  assert.ok(lookupView);
  assert.equal(lookupView.id, view.id);
  assert.equal(lookupView.externalReference, externalReference);

  const second = await create(idempotencyKey);
  assert.ok(second.response.ok || second.response.status === 201);
  const secondView = readProviderPaymentFromPayments(second.payload);
  assert.ok(secondView);
  assert.equal(secondView.id, view.id, "mesma X-Idempotency-Key deve reutilizar o payment");
});
