# ADR 001 — Prisma e Postgres

Status: PROPOSED

## Contexto

O site não tem Prisma. O ambiente local tem URLs de Prisma Postgres, diretas e pooled, que o código não lê. O evolUSG já separa runtime pooled e migration direta com Prisma 7 e `PrismaPg`.

## Decisão proposta

Quando o banco deste produto for confirmado:

- Runtime: `RUNTIME_DATABASE_URL` ou `DATABASE_URL`.
- Migration: `DIRECT_URL` ou `POSTGRES_URL` ou `DATABASE_URL`.
- Não usar `PRISMA_DATABASE_URL` até o esquema dela ser explicado. No `.env.local` atual ela é `postgres://` no host direto, não Accelerate.
- Client único em desenvolvimento via `globalThis`.
- Migrations versionadas. Sem `db push` como prática.
- `DATABASE_ENV` obrigatório antes de `migrate deploy`. Produção fora desse fluxo até uma sprint explícita.

## Pendência

Não está confirmado se essas URLs são deste produto nem se o host é desenvolvimento ou produção. Sem isso, a decisão não deve ser aplicada.

## Consequência

Nenhuma tabela nesta sprint.
