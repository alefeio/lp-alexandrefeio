# COM-1 — Pricing source of truth

Política: o **banco** (Admin / operação comercial) é a fonte de verdade dos preços. Seeds e deploys editoriais **não** regram preços de produtos existentes. Esta sprint **não** altera valores em Production.

## Auditoria — quem escreve vs quem lê

### Escrita comercial (pode mudar preço)

| Ponto | Arquivo | Comportamento |
| --- | --- | --- |
| Admin — preços (COM-2) | `src/lib/admin/pricing.ts` | Grava `priceCents` / `bundlePriceCents` a partir de reais |
| Create inicial de catálogo | `catalog-deploy.ts` / seeds | Define preço **só na criação** do registro |
| Editor pedagógico | `src/lib/editorial/service.ts` | **Não** regram preço comercial; FREE zera; PAID sem preço recebe placeholder |

### Leitura comercial (não deve sobrescrever)

| Ponto | Arquivo | Fonte |
| --- | --- | --- |
| Cotação / carrinho | `src/lib/commerce/quote.ts` | `lesson.priceCents` / bundles do catálogo carregado do DB |
| Pedido | `src/lib/commerce/orders.ts` | Snapshot da cotação no create do pedido |
| Ativação de venda | `src/lib/commerce/product-activation.ts` | Lê preço persistido; allowlist só por slug |
| Catálogo público | loaders de catálogo | DB |
| Prontidão editorial | `src/lib/editorial/readiness.ts` | Exige preço > 0 para PAID (validação, não hardcode de valor) |

### Seeds / deploy editorial (COM-1)

| Antes | Depois |
| --- | --- |
| `catalog-deploy` atualizava `priceCents` / `bundlePriceCents` | Update **omite** preços; create ainda usa seed |
| Seeds de aula gravavam `priceCents` no update | Update editorial **omite** preço |
| `SALE_ALLOWLIST` exigia igualdade com centavos fixos | Allowlist = **slug + kind**; preço válido = persistido > 0 |

### Continuação

- COM-2: UI Admin em reais, confirmação AVAILABLE e coerência — ver `docs/com-2-admin-pricing.md`
- Migration / mudança de preço em Production permanece fora de escopo até auditoria

## Critérios de aceite

1. Deploy/seed de conteúdo existente não altera `priceCents` / `bundlePriceCents` no DB.
2. Ativar venda não exige igualdade com lista hardcoded de centavos.
3. Produto fora da allowlist de slug continua bloqueado.
4. PAID sem preço válido (> 0) continua bloqueado.
5. Cotação/checkout continuam lendo o catálogo persistido; pedidos antigos preservam snapshot.
6. Nenhum valor de produto em Production é alterado por esta PR.
