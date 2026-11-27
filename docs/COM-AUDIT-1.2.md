# COM-AUDIT-1.2 — Proteção compartilhada e homologação isolada

## Gate A — Proteção financeira compartilhada

`applyProviderView` (webhook e admin) na camada compartilhada:

- Preserva `paymentMethodType` já registrado no claim (sem `preserveLocalMethod` opcional).
- Recusa sobrescrita de `providerPaymentId` por outro ID remoto.
- Revalida valor/moeda/referência sob `FOR UPDATE`.
- `method_mismatch` impede grant e **não** é limpo por webhook “compatível”.
- Distingue divergência financeira de outros `NEEDS_REVIEW`.
- Reembolso/chargeback legítimo sobre `APPROVED` permanece permitido (anti-regressão).
- Audit na mesma transação; falha de audit faz rollback (`__force_audit_fail__` só em teste).
- Outcomes administrativos: `applied` | `ignored` | `needs_review` | `rejected`.

Sem Payments API da PR #33.

### Testes (fixtures + `commerce_qa`)

Arquivo: `tests/database-live/commerce-shared-protection.database.test.ts`

1. Admin detecta método divergente  
2. Webhook posterior com o mesmo pagamento divergente  
3. Webhook “compatível” com divergência prévia ainda registrada  
4. Dois IDs remotos concorrentes  
5. Aprovação válida repetida  
6. Reembolso legítimo  
7. Falha de auditoria com rollback  

## Gate B — Banco de homologação

Preview Vercel `dpl_6THUCJicmVVWBatBJejrCEnU5DEy` **não** tem variáveis de banco dedicadas à branch. O Postgres efêmero do GitHub Actions **não** é o runtime do Preview.

| Alvo | hostClass | host | database | valueHash12 |
|---|---|---|---|---|
| Homologação local | localhost | 127.0.0.1:55434 | commerce_qa | 23a0ceee5e80 |
| Production (candidato `.env.local`) | prisma-postgres | pooled.db.prisma.io | postgres | 7766f8185b74 |

`sharesPhysicalProduction=false`. Migration só no isolado.

```bash
npx tsx scripts/setup-commerce-isolated-pg.ts   # se necessário (porta 55434)
npx tsx scripts/probe-homolog-isolation.ts      # sharesPhysicalProduction=false
npx tsx scripts/seed-com-audit-homolog.ts
```

Banco Preview Vercel dedicado: **requer autorização** (custo). Não alterar env global de Production.

Credenciais: `MERCADO_PAGO_ENV=test`, tokens de exemplo no isolado; sem cobrança real. E-mails reais: não usar contas Production; Resend rejeita `@example.com`.

## Gate C — Fixtures

`scripts/seed-com-audit-homolog.ts` — dados fictícios `@example.com`:

- Admin / comercial / teste  
- Pedidos: pago, pendente, pix, recusado, unknown, review (`method_mismatch`), reembolso, pago de teste  

## Gate D — Acesso seguro (homologação local)

1. Subir app com URLs isoladas ativas (`.env.commerce-isolated.local` + override).  
2. URL: `http://localhost:3000`  
3. Login admin: `com-audit-admin@example.com`  
4. Senha: `HOMOLOG_ADMIN_PASSWORD` ou padrão local do seed (somente `commerce_qa`).  
5. Rotas: `/admin`, `/admin/compras`, `/admin/compras/<id>`, `/admin/usuarios/<id>`, `/admin/jornada`  
6. Escopos: Comercial / Testes / Todos; filtros e paginação na gestão de compras.

Preview público da branch: útil para UI estática; **HOLD** como verdade comercial até banco Preview isolado autorizado.

Evidências: `docs/evidence/com-audit-1.2/` (desktop/mobile).

## GO / NO-GO

| Decisão | Escopo |
|---|---|
| **GO** | Homologação local isolada `commerce_qa` após seed + testes Gate A |
| **HOLD** | Preview Vercel como ambiente comercial (sem DB dedicado) |
| **NO-GO** | Production / merge / migrate Production / classificar contas reais |

PR #34 permanece **draft**. Não iniciar COM-CREDIT-1 nem Google Ads.
