# COM-AUDIT-1.1 — Fechamento técnico e homologação

## Correções

- Reconciliação admin: validação de id remoto, external_reference, pedido, BRL, valor tentativa/pedido, método; não sobrescreve método; divergência prévia preservada; outcome `applied|ignored|rejected|needs_review`; apply+audit na mesma transação quando há mutação.
- Classificação `isTestAccount` + audit atômicos; valores só `0`/`1`.
- Dashboard: agregação no universo filtrado (escopo antes da página); paginação; enums de status/método; anomalia de aprovações múltiplas; notas temporais/método.
- Jornada: exclusão de contas de teste em autenticados, progresso, diagnóstico, pedidos, cobertura e receita; anônimos preservados.
- Atenção: `charge_dispatched` / `outcome_unknown` / `IN_PROCESS` ≠ abandono.

## Migration / rollback

- Migration: `20261126010000_com_audit_1_commercial_ops` (aditiva).
- Rollback (somente homologação, com autorização):

```sql
DROP TABLE IF EXISTS "admin_audit_log";
ALTER TABLE "payment" DROP COLUMN IF EXISTS "originDeviceCategory";
ALTER TABLE "payment" DROP COLUMN IF EXISTS "originCorrelationId";
ALTER TABLE "payment" DROP COLUMN IF EXISTS "originChannel";
DROP INDEX IF EXISTS "user_isTestAccount_idx";
ALTER TABLE "user" DROP COLUMN IF EXISTS "isTestAccount";
```

**Não executar em Production sem autorização.**

## Homologação isolada

1. Confirmar identidade física do banco (`scripts/probe-commerce-isolated.ts` / `evaluateIsolatedCommerceDatabaseLive`).
2. Aplicar `npm run db:deploy` só no alvo isolado.
3. Criar fixtures fictícias (sem MP real).
4. Acessar admin com usuário ADMIN de teste.

Identidade sanitizada esperada (CI / local típico):

- hostClass: `localhost`
- host: `127.0.0.1`
- database: `commerce_qa`
- porta CI: `5432` · local exemplo: `55434`
- Production: **não**

URL de homologação (preview/staging do time): configurar no ambiente de preview da branch `feature/com-audit-1-commercial-operations` — tipicamente `https://<preview>.vercel.app/admin/compras` com sessão admin de fixture.

Checklist visual: visão geral, compras (filtros/escopos), detalhe, tentativas, classificação, auditoria, vazios, jornada — desktop e mobile.

## Limitações

- Funil por `anonymousId` pode incluir jornadas que depois autenticam como teste.
- Receita agregada no dashboard usa criação do pedido como recorte temporal; `approvedAt` pode cair fora.
