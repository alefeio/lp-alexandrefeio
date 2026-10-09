# ADR 005 — Autenticação

Status: ACCEPTED para e-mail e senha. PENDING para magic link e Google.

## Contexto

O site não tem conta. A plataforma precisa de aluno, admin, progresso e arquivo privado. O evolUSG usa Better Auth com e-mail, senha, verificação e reset, em cima de Prisma e Resend. Não usa magic link nem Google.

## Decisão

Better Auth, e-mail e senha, verificação obrigatória, recuperação de senha, Resend no servidor. Um usuário, papel `USER` ou `ADMIN`. O cadastro não envia o papel: o campo tem `input: false` e o hook de criação grava `USER`.

O primeiro admin não nasce por URL nem por e-mail fixo no client. No banco de desenvolvimento:

```text
npx tsx scripts/set-admin.ts pessoa@email.com
```

O script recusa `DATABASE_ENV=production`.

## Pendência

Magic link e Google continuam de fora.

## Consequência

`/entrar`, `/cadastro`, `/esqueci-senha`, `/redefinir-senha`, `/verificar-email`, `/app` e `/admin` existem. A home continua em `/`. Magic link e Google não foram adicionados.
