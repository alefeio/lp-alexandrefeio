# ADR 003 — Order e Entitlement

Status: PROPOSED

## Contexto

Aula, módulo e curso podem ser comprados. Módulo e curso abrem várias aulas. Valor já pago pode virar crédito de upgrade. Pagamento pode ficar pendente, recusado ou reembolsado.

## Decisão proposta

- `Order` e `OrderItem` registram a compra e o preço da época.
- `Payment` registra a transação e o status financeiro.
- `Entitlement` registra o direito de acesso e só nasce com pagamento `APPROVED`, crédito ou concessão.
- Crédito de upgrade é lançamento próprio, não um campo solto no entitlement.
- Acesso à aula considera entitlement da aula, do módulo ou do curso.

## Pendência

Se um reembolso revoga o acesso. Isso fica para a sprint de monetização.

## Consequência

“Pagou” e “pode ver” não são a mesma tabela. Mercado Pago ainda não entra.
