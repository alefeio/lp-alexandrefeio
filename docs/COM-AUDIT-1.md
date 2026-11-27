# COM-AUDIT-1 — Gestão comercial, auditoria e recuperação

## Inventário (Gate A)

| Superfície | Antes | Após |
|---|---|---|
| `/admin/compras` | Tabela simples (50 pedidos) | Dashboard com métricas, filtros, escopos Comercial/Testes/Todos, atenção |
| `/admin/compras/[id]` | Status + lista mínima de payments | Detalhe financeiro, tentativas, entitlements, audit, reconciliação |
| `/admin/usuarios` | Sem classificação de teste | Coluna + toggle administrativo com audit log |
| Visão geral | Commerce misturado | Métricas comerciais vs testes |
| Jornada | Pedidos pagos sem filtro de teste | Exclui `isTestAccount` da receita/pedidos comerciais |

### Dados reutilizados (sem schema)

- Order: status, totalCents, createdAt/updatedAt, user, items
- Payment: status, amount, refunds, method, providerStatus/Detail, providerPaymentId, approvedAt
- Entitlement via OrderItem
- Reconciliação: `fetchProviderPayment` + `applyProviderView` / `reconcileMercadoPagoPayment`

### Schema aditivo proposto

- `user.isTestAccount` (default false) — **somente marcação manual**
- `payment.originChannel`, `originCorrelationId`, `originDeviceCategory` — prospectivo
- `admin_audit_log` — classificação e reconciliação

Migration: `prisma/migrations/20261126010000_com_audit_1_commercial_ops/`

**Não executar em Production sem autorização.**

## Denominadores

- Taxa de conversão de pedidos = `PAID / total de pedidos no filtro`
- Tentativas recusadas **não** entram no denominador nem na receita
- Múltiplas tentativas do mesmo pedido **não** duplicam receita (soma por linha APPROVED/PARTIALLY_REFUNDED líquida)
- Contas de teste fora do escopo comercial por padrão
- Journey events anônimos = não identificados (não presumir cliente)

## Contas de teste

As três contas atuais **só** devem ser marcadas após confirmação do proprietário. Nenhum heurística por e-mail/nome.

## Reconciliação

1. Consultar MP — GET, audit log, sem escrita financeira
2. Reconciliar — GET + `applyProviderView` com validação order/id/moeda/valor; confirmação obrigatória; sem force PAID; sem nova cobrança admin
