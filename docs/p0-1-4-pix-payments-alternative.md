# P0.1.4 — Pix alternativo via Payments API

## Arquitetura

| Método | API | Persistência |
|--------|-----|--------------|
| Cartão | Orders (`/v1/orders`) | `providerApiKind=orders` |
| Pix | `MERCADO_PAGO_PIX_CHARGE_API=orders` (padrão) **ou** `payments` | `providerApiKind` gravado no claim |

A escolha ocorre **antes** do despacho (`claimChargeDispatch`) e fica em `Payment.providerApiKind`.  
Não há troca automática de API após timeout, pendência ou resultado desconhecido.

## Compatibilidade da aplicação

- A mesma aplicação Mercado Pago (`APP_USR`) costuma atender Orders e Payments.
- Pix exige **chave Pix cadastrada** na conta recebedora (docs oficiais).
- Se Payments rejeitar Pix por restrição de conta, **não** migrar automaticamente — avaliar Checkout Pro ou outro provedor após evidência.
- **Não** alterar a configuração da aplicação do cartão nesta sprint.
- Nova aplicação só se o titular concluir que a atual não habilita Payments/Pix; documentar e solicitar ação humana.

## Credenciais

- Teste: Access Token de teste + `MERCADO_PAGO_ENV=test`.
- Production: credenciais Production existentes; piloto só com autorização explícita.
- Nunca versionar segredos.

## Migration

`prisma/migrations/20261120194500_add_payment_provider_api_kind` — **aditiva**, coluna `providerApiKind`.  
**Não executar em Production** sem autorização.

## Webhooks

A rota `/api/webhooks/mercado-pago` aceita:

- `type=order` → reconcilia via Orders GET
- `type=payment` → reconcilia via Payments GET

Sempre consulta o recurso remoto; nunca confia só no body.

## Sandbox

```bash
MP_PAYMENTS_PIX_SANDBOX_TEST=1 MERCADO_PAGO_ENV=test npx tsx --test tests/mercado-pago-payments-pix-sandbox.test.ts
```

### Resultado local (2026-11-20)

| Checagem | Resultado |
|----------|-----------|
| Unitários | PASS (incl. adaptador Payments + seleção de API) |
| Lint / typecheck / build | PASS |
| `GET /users/me` com token local | HTTP 200 (token válido) |
| Sandbox `POST /v1/payments` Pix | **FAIL HTTP 401** — `Unauthorized use of live credentials` (cause 7) |

O `.env.local` tem `MERCADO_PAGO_ENV=test`, mas o Access Token é de **produção** (live).  
A Payments API recusa misturar credencial live com fluxo de teste.

**Ação do titular (sem alterar a app do cartão):**

1. No painel Developers do Mercado Pago, copiar **Credenciais de teste** (`Access Token` de teste).
2. Usar só em ambiente local/CI de sandbox (nunca versionar).
3. Reexecutar: `MP_PAYMENTS_PIX_SANDBOX_TEST=1` + token de teste.
4. Confirmar QR / copia-e-cola / GET / idempotência.

Nova aplicação Mercado Pago **não** é obrigatória só por causa deste 401; basta o par de credenciais de teste da app atual.  
Se, com token de teste válido, Pix ainda falhar por restrição de conta/chave Pix, registrar e avaliar Checkout Pro — sem migração automática.

Até o sandbox autenticar e devolver QR + GET + idempotência: **NO-GO** para piloto Production.

## Piloto Production (não automático)

1. Autorização do responsável  
2. `MERCADO_PAGO_PIX_CHARGE_API=payments`  
3. Migration aplicada  
4. Comprador ≠ recebedora  
5. Uma cobrança  
6. QR válido + PAID + entitlement  
7. Rollback: voltar env para `orders`
