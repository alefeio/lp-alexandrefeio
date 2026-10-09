# Sprint 1 — fundação de dados e autenticação

Gate 0 confirmado em 9 de outubro de 2026: as URLs locais são do Postgres de desenvolvimento do Alexandre Feio. A migration de autenticação foi autorizada nesse banco. Não é o banco do evolUSG e não é production.

## O que foi implementado

- Prisma 7.10 e `PrismaPg`.
- Runtime só em `RUNTIME_DATABASE_URL`.
- CLI e migration só em `POSTGRES_URL`.
- `DATABASE_URL` e `PRISMA_DATABASE_URL` continuam no ambiente e não são lidas pelo código.
- `DATABASE_ENV=development` no ambiente local. `scripts/run-prisma.ts` recusa production.
- Models `User`, `Session`, `Account`, `Verification`. Campo `role` com default `USER`.
- Migration `20261009190000_auth_foundation`, revisada e aplicada com `prisma migrate deploy` no banco de desenvolvimento (`db.prisma.io`). Sem `db push`.
- Better Auth 1.7: e-mail e senha, verificação obrigatória, recuperação de senha, sessão httpOnly, rate limit de 10 pedidos por minuto.
- E-mails de verificação e de senha pelo Resend, separados do formulário comercial.
- Route groups `(public)`, `(auth)`, `(app)` e `(admin)`. As URLs públicas continuam `/`, `/trafego-pago`, `/privacidade` e `/obrigado`.
- `/app` exige sessão. O proxy olha o cookie; o layout confirma a sessão no servidor.
- `/admin` exige `role = ADMIN`. Usuário comum vê “Sem acesso”. A página também só renderiza o conteúdo administrativo com essa role. O primeiro admin é `npx tsx scripts/set-admin.ts pessoa@email.com`, só fora de production.
- Política de privacidade atualizada para conta, hash de senha, sessão e e-mail de verificação/recuperação. Sem pagamento, arquivo ou diagnóstico.
- Headers `nosniff`, `Referrer-Policy`, `X-Frame-Options` e `Permissions-Policy`. Sem CSP, para não quebrar GTM.

## Variáveis

| Variável | Uso |
| --- | --- |
| `RUNTIME_DATABASE_URL` | Client em runtime, conexão pooled |
| `POSTGRES_URL` | Prisma CLI e migrations, conexão direta |
| `DATABASE_URL` | Presente, não lida |
| `PRISMA_DATABASE_URL` | Presente, não lida |
| `DATABASE_ENV` | `development` neste banco. Bloqueia migration sem rótulo seguro |
| `BETTER_AUTH_SECRET` | Segredo de sessão, só no servidor |
| `BETTER_AUTH_URL` | Origem dos links de e-mail. Em preview, se vazia, usa `VERCEL_URL`. Em production, se vazia, usa `https://alexandrefeio.com.br` |
| `RESEND_API_KEY`, `CONTACT_FROM_EMAIL`, `CONTACT_REPLY_TO_EMAIL` | Mesmas do formulário, em funções separadas |

`APIMG_API_KEY` e `APIMG_UPLOAD_URL` continuam ausentes. Upload não faz parte desta sprint. Quando entrar, as duas variáveis ficam só no servidor.

## Produção

Este banco não deve ir para production. Antes de ligar a área autenticada no ar: banco separado, variáveis por ambiente na Vercel, e `migrate deploy` controlado nesse banco novo.

O build consegue gerar o Prisma Client sem URL real. Sem `RUNTIME_DATABASE_URL` e `BETTER_AUTH_SECRET` em production, login e `/app` não funcionam. A home não depende disso.

## Pendências

- Magic link e Google: PENDING.
- Storage privado: PENDING. ADR 004 segue como estava.
- Blocos de aula e Order/Entitlement: ainda PROPOSED, sem tabela.
- CSP completa: adiada por causa do GTM.
- Rate limit do Better Auth é por instância. Não foi adicionado serviço externo.
- O formulário comercial continua só com honeypot e tempo mínimo.
