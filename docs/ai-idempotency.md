# Idempotência operacional de IA (Gate 4.2B-2)

## Objetivo

Impedir que repetição involuntária (duplo clique, reenvio, concorrência) dispare
múltiplas chamadas pagas ao provedor para a mesma intenção lógica do usuário.

Não é cache de respostas. Não altera precificação nem o ledger `AiProviderCall`.

## Chave lógica

Escopo: `(userId, featureKey, idempotencyKey)` + `fingerprintHash`.

- `idempotencyKey`: gerada no cliente por intenção de clique (UUID). Nova chave = nova geração legítima.
- `fingerprintHash`: SHA-256 de representação canônica dos parâmetros relevantes no servidor (sem armazenar prompt/resposta/conteúdo).
- Mesma chave + mesmo fingerprint = mesma execução.
- Mesma chave + fingerprint diferente = conflito controlado.
- Ausência de chave = rejeição (`*_IDEMPOTENCY_REQUIRED`). Clientes antigos não contornam a proteção.

## Tabela `ai_operation_reservation`

Estados: `IN_PROGRESS` → `COMPLETED` | `FAILED` | `UNKNOWN`.

Campo `generation` (fencing token): começa em `1`. Todo reclaim faz `generation = generation + 1`.

Reserva atômica via `INSERT ... ON CONFLICT DO NOTHING` no PostgreSQL (multi-instância Vercel).

## Contrato de propriedade (fencing)

Cada autorização carrega `{ id, generation }`.

1. Despacho (`providerDispatched=true`) só com
   `WHERE id AND generation AND status='IN_PROGRESS' AND providerDispatched=false AND expiresAt > now RETURNING *`.
2. Lease expirado **não** pode iniciar chamada ao provedor (despacho tardio recusado).
3. Transições finais (`COMPLETED`/`FAILED`/`UNKNOWN`) só com
   `WHERE id AND generation AND status='IN_PROGRESS' RETURNING *` (a geração dona que já despachou ainda pode finalizar após o relógio do lease).
4. Zero linhas = perda de propriedade — **nunca** tratado como sucesso.
5. Se a confirmação de despacho falhar, o provedor **não** é chamado.
6. Execução antiga após reclaim não consegue despachar nem finalizar a geração nova.
7. Expiração do lease **não** autoriza repetir chamada já despachada: promove a `UNKNOWN`.

## Classificação de falhas

| Situação | Estado da reserva | Recuperável com a mesma chave? |
| --- | --- | --- |
| Falha comprovada **antes** do despacho confirmado | `FAILED` | Sim |
| Resposta HTTP definitiva do provedor (erro de API) | `FAILED` | Sim |
| Resposta recebida e rejeitada pela validação da aplicação | `FAILED` | Sim |
| Timeout / transporte após possível envio | `UNKNOWN` | Não |
| Falha na gravação do ledger após resposta válida | `COMPLETED` (resposta preservada) | — |
| Falha na atualização final da reserva após resposta válida | resposta preservada ao cliente; métrica de ownership | — |
| Perda de fencing no despacho | sem chamada ao provedor; `ownership_lost` | Nova intenção / aguardar |

Limite das garantias: após `UNKNOWN`, não há reconciliação automática com o provedor nesta sprint.

## Transições

| Situação | Efeito |
| --- | --- |
| Primeira reserva | `IN_PROGRESS`, `generation=1`, autoriza |
| Concorrente mesma chave+fp | `IN_PROGRESS` ativo → bloqueia sem provedor |
| Mesma chave+fp `COMPLETED` | reconhece concluída, sem reexecução |
| Mesma chave+fp `FAILED` | reclaim com `generation++` |
| Mesma chave+fp `UNKNOWN` | bloqueia repetição paga insegura |
| Fingerprint diferente | conflito |
| `IN_PROGRESS` expirado sem despacho | reclaim com `generation++` |
| `IN_PROGRESS` expirado com despacho | promove a `UNKNOWN` |
| Banco indisponível | não segue com geração paga |

TTL padrão de lease: 180s.

## Ledger

Duplicata bloqueada **antes** do provedor não gera `AiProviderCall`.
Retries/repairs internos na mesma ação lógica compartilham `requestId` com `attempt` distinto.

## Métricas

Contadores agregáveis (sem conteúdo privado): authorized, duplicate_blocked,
in_progress, fingerprint_conflict, unknown_blocked, store_failure, missing_key,
completed, failed, unknown_marked, reclaimed.
Não representam economia financeira nem entram em GA4/GTM/JourneyEvent.

## Teste PostgreSQL isolado

O banco local compartilhado (`DATABASE_ENV=development` no mesmo Postgres de production)
**não** é ambiente isolado. Não aplicar a migration de idempotência nem rodar o teste live nele.

### Banco temporário recomendado

Postgres descartável local (Docker) **ou** projeto Prisma/Neon/Supabase separado, dedicado a teste,
com nome de database distinto (ex.: `ai_idempotency_test`). Não reutilizar o pooled `postgres` de production.

Exemplo Docker (sessão local apenas):

```bash
docker run --rm -d --name ai-idem-pg -e POSTGRES_PASSWORD=test -e POSTGRES_DB=ai_idempotency_test -p 5433:5432 postgres:16
```

### Variáveis (somente na sessão de teste)

Não gravar essas URLs em `.env.local` de development compartilhado.

```text
DATABASE_ENV=test
VERCEL_ENV=          # vazio / não production
SHARED_DATABASE_TEST_CONFIRM=true
ISOLATED_AI_IDEMPOTENCY_TEST=1
ISOLATED_AI_IDEMPOTENCY_DATABASE_URL=<url do banco isolado>
RUNTIME_DATABASE_URL=<mesma url isolada>
POSTGRES_URL=<mesma url isolada, conexão direta para migrate>
```

Proteções anti-fallback:

- O client de runtime **só** lê `RUNTIME_DATABASE_URL` (não cai em `DATABASE_URL`).
- O live test exige `ISOLATED_AI_IDEMPOTENCY_*` e recusa host Prisma compartilhado aparente (`db.prisma.io` + db `postgres`).
- `UNIT_TEST_ISOLATION=1` no `npm test` impede acesso ao banco compartilhado.

### Migrations só no destino isolado

Com as variáveis acima na sessão:

```bash
npm run db:deploy
```

Não executar `db:deploy` com `RUNTIME_DATABASE_URL`/`POSTGRES_URL` do site em production.

### Seed sintético mínimo

Criar um `user` sintético (id/email fictícios) no banco isolado — o teste precisa de `prisma.user.findFirst()`.
Não copiar usuários reais.

### Executar e limpar

```bash
npx tsx --test tests/database-live/ai-idempotency.live.test.ts
# ou a suíte completa com as mesmas variáveis:
# npm run test:database-live
```

Os testes apagam as linhas de `ai_operation_reservation` criadas pela chave sintética.
Ao terminar: derrubar o container / apagar o projeto de teste. Não deixar credenciais no histórico do shell.
