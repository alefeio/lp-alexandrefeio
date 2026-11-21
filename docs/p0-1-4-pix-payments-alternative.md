# P0.1.4 — Pix alternativo via Payments API

## Arquitetura

| Método | API | Persistência |
|--------|-----|--------------|
| Cartão | Orders (`/v1/orders`) | `providerApiKind=orders` |
| Pix | `MERCADO_PAGO_PIX_CHARGE_API=orders` (padrão) **ou** `payments` | `providerApiKind` gravado no claim |

A escolha ocorre **antes** do despacho (`claimChargeDispatch`) e fica em `Payment.providerApiKind`.  
Não há troca automática de API após timeout, pendência ou resultado desconhecido.

Reconciliação (`selectPaymentForProviderView` + lock de pedido/tentativas):

1. Preferência por `providerPaymentId` exato.
2. Corrida (webhook antes do HTTP): só tentativa **aberta** (`PENDING`/`IN_PROCESS`), mesmo valor, kind compatível e método compatível.
3. Payments **não** associa a legado `null`/Orders.
4. Tentativas rejeitadas antigas não recebem webhook novo só porque pedido+valor coincidem.

## Compatibilidade da aplicação

- A mesma aplicação Mercado Pago (`APP_USR`) costuma atender Orders e Payments.
- Pix exige **chave Pix cadastrada** na conta recebedora.
- **Não** alterar a configuração da aplicação do cartão nesta sprint.
- Webhook: configurar tópico `payment` (e manter `order`) para a URL `/api/webhooks/mercado-pago`.

## Credenciais de teste (sandbox)

Exclusivas — **sem** fallback para `MERCADO_PAGO_ACCESS_TOKEN`:

```bash
MERCADO_PAGO_ENV=test
MERCADO_PAGO_TEST_ACCESS_TOKEN=…   # painel → Credenciais de teste
MERCADO_PAGO_TEST_CREDENTIAL_SOURCE=developers_test_credentials
MP_PAYMENTS_PIX_SANDBOX_TEST=1
```

Preflight read-only `GET /users/me` antes de qualquer `POST /v1/payments`.  
Recusa token idêntico ao genérico e ambientes Production.

```bash
npx tsx --test tests/mercado-pago-payments-pix-sandbox.test.ts
```

## Migration

`prisma/migrations/20261120194500_add_payment_provider_api_kind` — **aditiva**.  
**Não executar em Production** sem autorização.

## Webhooks

- `type=order` → Orders GET
- `type=payment` → Payments GET  
Sempre consulta o recurso remoto; valida assinatura e `live_mode`.

## Método Pix (Payments)

Não presume `bank_transfer` quando `payment_type_id` falta.  
Exige evidência: `payment_type_id`, `payment_method_id=pix` ou `point_of_interaction` PIX/QR.  
Sem evidência → `NEEDS_REVIEW`, sem entitlement.

## Piloto Production

**NO-GO** até sandbox com token de teste autenticar e devolver QR + GET + idempotência, com autorização explícita do titular.
