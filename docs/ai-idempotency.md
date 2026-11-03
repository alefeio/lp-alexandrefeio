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

Reserva atômica via `INSERT ... ON CONFLICT DO NOTHING` no PostgreSQL (multi-instância Vercel).

## Transições

| Situação | Efeito |
| --- | --- |
| Primeira reserva | `IN_PROGRESS`, autoriza provedor |
| Concorrente mesma chave+fp | `IN_PROGRESS` ativo → bloqueia sem provedor |
| Mesma chave+fp `COMPLETED` | reconhece concluída, sem reexecução |
| Mesma chave+fp `FAILED` | permite reclaim (recuperação) |
| Mesma chave+fp `UNKNOWN` | bloqueia repetição paga insegura |
| Fingerprint diferente | conflito |
| `IN_PROGRESS` expirado sem `providerDispatched` | reclaim seguro |
| `IN_PROGRESS` expirado com `providerDispatched` | promove a `UNKNOWN` |
| Timeout após possível envio | `UNKNOWN` |
| Falha antes do envio | `FAILED` |
| Banco indisponível | não segue com geração paga |

TTL padrão de lease: 180s.

## Ledger

Duplicata bloqueada **antes** do provedor não gera `AiProviderCall`.
Retries/repairs internos na mesma ação lógica compartilham `requestId` com `attempt` distinto.

## Métricas

Contadores agregáveis (sem conteúdo privado): authorized, duplicate_blocked,
in_progress, fingerprint_conflict, unknown_blocked, store_failure, completed, failed, unknown_marked.
Não representam economia financeira nem entram em GA4/GTM/JourneyEvent.
