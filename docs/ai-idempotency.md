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
   `WHERE id AND generation AND status='IN_PROGRESS' AND providerDispatched=false RETURNING *`.
2. Transições finais (`COMPLETED`/`FAILED`/`UNKNOWN`) só com
   `WHERE id AND generation AND status='IN_PROGRESS' RETURNING *`.
3. Zero linhas = perda de propriedade — **nunca** tratado como sucesso.
4. Se a confirmação de despacho falhar, o provedor **não** é chamado.
5. Execução antiga após reclaim não consegue despachar nem finalizar a geração nova.
6. Expiração do lease **não** autoriza repetir chamada já despachada: promove a `UNKNOWN`.

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
**não** é ambiente isolado. Não aplicar a migration de idempotência nem rodar o teste live nele
sem autorização explícita de schema compartilhado.

Para aprovar a atomicidade multi-instância:

1. Provisionar um Postgres **separado** (não production, não o pooled compartilhado do site).
2. Definir `ISOLATED_AI_IDEMPOTENCY_DATABASE_URL` (URL desse banco).
3. Definir `RUNTIME_DATABASE_URL` / `POSTGRES_URL` apontando **somente** para esse banco isolado na sessão de teste.
4. `DATABASE_ENV=test`
5. `SHARED_DATABASE_TEST_CONFIRM=true` (confirmação explícita do runner)
6. `ISOLATED_AI_IDEMPOTENCY_TEST=1`
7. Aplicar migrations **apenas** nesse banco: `npm run db:deploy`
8. `npm run test:database-live` (o arquivo `ai-idempotency.live.test.ts` recusa host/produção compartilhada)

Não imprimir credenciais. Não usar fallback silencioso para `DATABASE_URL` de production.
