# ADR 002 — Conteúdo em blocos

Status: PROPOSED

## Contexto

As aulas da V1 são texto interativo, não vídeo e não um CMS genérico. O progresso do aluno precisa sobreviver a edição.

## Decisão proposta

A aula é uma lista de blocos tipados (`TEXT`, `HEADING`, `EXAMPLE`, `CALLOUT`, `CHECKPOINT`, `QUESTION`, `ACTIVITY`, `CHECKLIST`, `RESULT`, `CONCLUSION`). Cada bloco tem `blockKey` estável. Ordem é outro campo. Progresso, resposta e último bloco usam essa chave. Pixel de scroll não é persistido como progresso. Remover um bloco aposenta a chave.

## Consequência

O admin edita tipos conhecidos, não HTML livre. Não há schema ainda.
