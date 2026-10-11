# ADR 003 — Order e Entitlement

Status: ACCEPTED

## Contexto

Aula, módulo e curso podem ser comprados. O preço muda. Um reembolso não pode apagar outra compra da mesma aula. O conteúdo pago atual ainda não está pronto para venda.

## Decisão

- `Order` e `OrderItem` guardam a compra e o preço da época. Um item aponta para exatamente uma aula, um módulo ou um curso.
- `OrderItemLesson` é o snapshot das aulas incluídas. Aula nova no catálogo não entra numa compra antiga.
- `Payment` é a tentativa financeira. Várias tentativas podem existir. Só `APPROVED` libera.
- `Entitlement` é por aula, com status `ACTIVE` ou `REVOKED`. O par `orderItemId + lessonId` é único. O mesmo usuário pode ter mais de um entitlement da mesma aula, vindos de itens diferentes.
- Acesso pergunta se existe ao menos um entitlement `ACTIVE`. Aula `FREE` publicada não precisa de entitlement.
- Crédito de upgrade é calculado na hora do quote a partir de `finalPriceCents` de pedidos `PAID` contidos no pacote. Não há tabela de carteira.
- Reembolso total e chargeback revogam os entitlements daquela compra. Outra fonte ativa permanece. Reembolso parcial não revoga sozinho: o pedido fica `NEEDS_REVIEW`.
- `commerceStatus` separa “exige compra” de “pode ser cobrado agora”.

## Consequência

“Pagou” e “pode ver” continuam em tabelas diferentes. O crédito não é moeda. A política de aula nova para comprador antigo fica fora desta versão.
