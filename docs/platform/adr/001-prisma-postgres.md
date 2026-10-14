# ADR 001 — Prisma e Postgres

Status: ACCEPTED

## Contexto

O site não usava banco. As quatro URLs locais são do Postgres de desenvolvimento criado para Alexandre Feio, não do evolUSG. Não há dados de aluno, curso ou pagamento. O site público de marketing não depende desse banco.

## Decisão

- Runtime: somente `RUNTIME_DATABASE_URL` (pooled, `pooled.db.prisma.io`).
- Migrations e CLI: somente `POSTGRES_URL` (direta, `db.prisma.io`).
- `DATABASE_URL` permanece no ambiente, igual à conexão direta, e o código não a lê.
- `PRISMA_DATABASE_URL` fica fora de runtime e de migration.
- Prisma 7 com `PrismaPg`. Em desenvolvimento o client fica em `globalThis`.
- Migrations versionadas. Sem `db push`.
- `DATABASE_ENV=development` neste banco. O script de migration recusa `production` e recusa ambiente sem rótulo `development`, `preview` ou `test`.

## Produção

Esta seção foi substituída. Development e production usam o mesmo Postgres físico. `DATABASE_ENV` é o runtime, não um segundo banco. O procedimento está em [production-launch.md](../production-launch.md). Não provisionar outro banco.

O build da Vercel pode gerar o client sem essas variáveis. Uma rota autenticada em production sem `RUNTIME_DATABASE_URL` falha ao ser usada. A home não importa o client.

## Consequência

A migration `20261009190000_auth_foundation` foi aplicada neste banco de desenvolvimento.
