# Pagamentos

Status: fundação da Sprint 5 no banco de development. Comércio desligado por padrão. Mercado Pago só entra com credencial de teste.

## Separação

`Order` é a compra. `Payment` é a tentativa no provider. `Entitlement` é o direito de abrir uma aula. Crédito de upgrade não é saldo: é a soma do valor efetivamente pago em itens `PAID` cujo snapshot de aulas cabe no pacote maior.

Detalhe de quote, Pix, cartão, webhook, reembolso e gate de production: [sprint-5-commerce.md](./sprint-5-commerce.md). A decisão de acesso está no [ADR 003](./adr/003-order-entitlement.md).

## Regras que o código aplica

1. Preço, crédito e total nascem no servidor. O client manda só o tipo e o id do produto.
2. `PAID` não significa vendável. A cobrança exige produto `AVAILABLE` e o comércio global habilitado, no modo de teste ou de production descritos em [production-launch.md](./production-launch.md). Teste exige `COMMERCE_ENABLED`, `MERCADO_PAGO_ENV=test` e `DATABASE_ENV=development`, fora de `VERCEL_ENV=production`. Production exige também `COMMERCE_PRODUCTION_READY`, `MERCADO_PAGO_ENV=production`, `DATABASE_ENV=production` e `VERCEL_ENV=production`. O prefixo da credencial não entra nessa decisão. `catalog:deploy` sincroniza conteúdo e preço e não altera a disponibilidade de um produto que já existe. `npm run commerce:products` é a ativação explícita. Ficar pronta ou publicada não marca `AVAILABLE`.
3. Entitlement é por aula. Módulo e curso gravam o snapshot e concedem uma aula por linha. Há mais de uma fonte para o mesmo usuário e a mesma aula.
4. Acesso pago exige pelo menos um entitlement `ACTIVE`. Aula gratuita publicada não precisa.
5. Pagamento `PENDING` não libera. `APPROVED` libera uma vez. Reembolso total e chargeback revogam a fonte daquela compra. Reembolso parcial marca `NEEDS_REVIEW` e não escolhe aula para revogar.
6. Upgrade de valor zero não chama o Mercado Pago.
7. Access token e segredo do webhook não vão ao browser. Log de pagamento não leva token, PAN, CVV nem corpo do provider.
