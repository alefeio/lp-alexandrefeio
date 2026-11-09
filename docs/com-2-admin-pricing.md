# COM-2 — Admin pricing management

Gestão comercial de preços no Admin, em reais (pt-BR), com o banco como fonte de verdade. Esta sprint **não** altera valores em Production nem ativa o piloto C1.

## Gate 0 — Auditoria (pré-COM-2 → pós)

### Caminhos de escrita de preço

| Antes | Depois |
| --- | --- |
| Editor pedagógico (`saveCourse` / `saveModule` / `saveLesson`) gravava centavos do formulário | Editor **preserva** preços; FREE zera; PAID sem preço recebe placeholder `100` só para prontidão |
| Campos “Preço em centavos” nas páginas de curso/módulo/aula | Removidos; link para `/admin/precos` |
| — | Novo: `src/lib/admin/pricing.ts` + `/admin/precos` |

### Efeito de mudar preço de produto AVAILABLE

- Catálogo/cotação passam a ler o novo valor na próxima carga.
- Pedidos já criados **não** mudam (snapshot em `OrderItem`).
- Entitlements / status de venda **não** mudam nesta ação.
- Créditos de upgrade continuam baseados em `finalPriceCents` pago.

### Histórico comercial

Não há tabela de auditoria de alterações de preço. Apenas `updatedAt` / `updatedById` no próprio produto. Limitação documentada; não inventamos trilha nesta sprint. Sem migration.

## Responsabilidades

| Área | Papel |
| --- | --- |
| `/admin/cursos`, `/admin/modulos`, `/admin/aulas` | Conteúdo, publicação, abrir/fechar venda |
| `/admin/precos` | Preços comerciais em R$ |

## Regras monetárias

- Entrada: `14,90`, `R$ 14,90`, `1.234,56` ou reais inteiros (`15`).
- Rejeita: negativo, `14.90` (ambíguo), NaN/Infinity, acima de R$ 99.999,99, zero para produto pago.
- Gravação sempre em centavos inteiros; sem float financeiro.
- FREE: sem preço comercial.

## Confirmação AVAILABLE

Servidor exige `confirmAvailable` quando o produto está AVAILABLE e o valor muda. UI mostra preço atual → novo e avisa sobre cotações futuras vs pedidos preservados.

## Concorrência

Compara `updatedAt` ISO esperado; conflito se desatualizado.

## Checkout (sem mudança de integração)

Compatibilidade garantida por não tocar em Mercado Pago, orders create, entitlements nem quote math — só a fonte persistida de preço.
