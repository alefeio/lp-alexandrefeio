import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { config as loadEnv } from "dotenv";
import test from "node:test";
import { hasPresentablePix } from "../src/lib/commerce/provider";
import {
  readPixFromPayments,
  readProviderPaymentFromPayments,
} from "../src/lib/commerce/payments-api";
import {
  preflightMercadoPagoTestToken,
  resolveMercadoPagoTestAccessToken,
} from "../src/lib/commerce/sandbox-credentials";

/**
 * Sandbox Payments API Pix (não Orders).
 * Ativar: MP_PAYMENTS_PIX_SANDBOX_TEST=1
 * Credencial exclusiva: MERCADO_PAGO_TEST_ACCESS_TOKEN
 * Confirmação: MERCADO_PAGO_TEST_CREDENTIAL_SOURCE=developers_test_credentials
 * Sem fallback para MERCADO_PAGO_ACCESS_TOKEN.
 */
loadEnv({ path: ".env.local" });

const enabled = process.env.MP_PAYMENTS_PIX_SANDBOX_TEST === "1";

test("sandbox Payments API Pix: preflight, create, QR, GET, idempotência", { skip: !enabled }, async () => {
  const resolved = resolveMercadoPagoTestAccessToken(process.env);
  assert.equal(resolved.ok, true, resolved.ok ? "" : resolved.reason);
  if (!resolved.ok) return;

  const accessToken = resolved.token;
  const preflight = await preflightMercadoPagoTestToken(accessToken);
  assert.equal(preflight.ok, true, preflight.ok ? "" : preflight.reason);
  if (!preflight.ok) return;

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
  assert.ok(view.paymentTypeId === "bank_transfer" || view.paymentTypeId === "pix");

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
