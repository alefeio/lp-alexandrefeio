# Pagamentos

Status: fundação da Sprint 5 no banco de development. Comércio desligado por padrão. Mercado Pago só entra com credencial de teste.

## Separação

`Order` é a compra. `Payment` é a tentativa no provider. `Entitlement` é o direito de abrir uma aula. Crédito de upgrade não é saldo: é a soma do valor efetivamente pago em itens `PAID` cujo snapshot de aulas cabe no pacote maior.

Detalhe de quote, Pix, cartão, webhook, reembolso e gate de production: [sprint-5-commerce.md](./sprint-5-commerce.md). A decisão de acesso está no [ADR 003](./adr/003-order-entitlement.md).

## Regras que o código aplica

1. Preço, crédito e total nascem no servidor. O client manda só o tipo e o id do produto.
2. `PAID` não significa vendável. `commerceStatus = AVAILABLE` é que libera a cobrança, e só com `COMMERCE_ENABLED` fora de production.
3. Entitlement é por aula. Módulo e curso gravam o snapshot e concedem uma aula por linha. Há mais de uma fonte para o mesmo usuário e a mesma aula.
4. Acesso pago exige pelo menos um entitlement `ACTIVE`. Aula gratuita publicada não precisa.
5. Pagamento `PENDING` não libera. `APPROVED` libera uma vez. Reembolso total e chargeback revogam a fonte daquela compra. Reembolso parcial marca `NEEDS_REVIEW` e não escolhe aula para revogar.
6. Upgrade de valor zero não chama o Mercado Pago.
7. Access token e segredo do webhook não vão ao browser. Log de pagamento não leva token, PAN, CVV nem corpo do provider.
