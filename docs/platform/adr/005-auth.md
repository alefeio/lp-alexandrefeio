# ADR 005 — Autenticação

Status: PROPOSED para e-mail e senha. PENDING para magic link e Google.

## Contexto

O site não tem conta. A plataforma precisa de aluno, admin, progresso e arquivo privado. O evolUSG usa Better Auth com e-mail, senha, verificação e reset, em cima de Prisma e Resend. Não usa magic link nem Google.

## Decisão proposta

Better Auth, e-mail e senha, verificação obrigatória, recuperação de senha, Resend no servidor. Um usuário, papel `student` ou `admin`. Sem allowlist clínica.

## Pendência

Magic link e Google podem ser acrescentados depois se a conta continuar identificada pelo e-mail verificado. Não adicionar provedor agora.

## Consequência

Nenhuma rota `/app` nesta sprint. O layout global precisa de route group antes da primeira página autenticada.
