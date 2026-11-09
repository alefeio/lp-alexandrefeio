# COM-2 — Admin pricing management

Gestão comercial de preços no Admin, em reais (pt-BR), com o banco como fonte de verdade. Esta sprint **não** altera valores em Production nem ativa o piloto C1.

## COM-2.1 — Safety & preview hardening

### Concorrência atômica

`updateProductPrice` exige `expectedUpdatedAt` ISO não vazio e válido. A escrita usa `updateMany` com compare-and-swap em `id` + `updatedAt` + `commerceStatus` (e `accessType: PAID` para aulas). Se `count !== 1`, retorna conflito sem alterar preço.

### Placeholder monetário

`createLesson` / `saveLesson` **não** atribuem mais `100` centavos. PAID em rascunho pode ficar com `priceCents = null` até o admin definir em `/admin/precos`. Publicação e venda continuam bloqueadas pela prontidão existente quando falta preço válido.

#### Identificar possíveis placeholders antigos (`priceCents = 100`)

Registros históricos **não** são alterados automaticamente. Para revisão humana:

```sql
SELECT id, slug, title, "priceCents", status, "commerceStatus", "updatedAt"
FROM lesson
WHERE "accessType" = 'PAID' AND "priceCents" = 100;
```

`100` pode ser preço legítimo (R$ 1,00). Confirmar caso a caso antes de qualquer correção manual.

### Parser BRL

Aceita só formatos pt-BR válidos (`14,90`, `R$ 14,90`, `1.234,56`, `15`, `1.234`). Rejeita milhares malformados (`1.2,34`, `12.34,56`, `1.2.3`), decimal com ponto (`14.90`), negativos e fora do limite.

### Simulação

`projectPricingDesk` (em `pricing-core.ts`, seguro para client) recalcula somas/economia a partir de rascunhos locais. A UI distingue **publicado** vs **proposto**; nada é gravado até salvar. Escrita fica em `pricing.ts` (`server-only`).

## Responsabilidades

| Área | Papel |
| --- | --- |
| `/admin/cursos`, `/admin/modulos`, `/admin/aulas` | Conteúdo, publicação, abrir/fechar venda |
| `/admin/precos` | Preços comerciais em R$ |

## Confirmação AVAILABLE

Servidor exige `confirmAvailable` quando o produto está AVAILABLE e o valor muda.

## Histórico comercial

Não há tabela de auditoria de alterações de preço. Apenas `updatedAt` / `updatedById`. Sem migration.

## Checkout

Sem alteração em Mercado Pago, orders, entitlements ou quote math — só a fonte persistida de preço via Admin.
