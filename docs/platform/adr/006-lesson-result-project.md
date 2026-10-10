# ADR 006 — Resultado da aula e projeto

Status: aceito na Sprint 3.

## Contexto

O progresso de leitura pertence à pessoa e à aula. O resultado prático pode ser refeito para outro negócio. O unique `userId + lessonId` impedia isso.

## Decisão

`LessonResult.projectId` é opcional.

- `projectId` nulo: um resultado pessoal da aula. É o que o leitor grava hoje.
- `projectId` preenchido: um resultado daquela aula naquele projeto.

O Postgres não trata vários nulos como iguais num unique comum. A migration usa dois índices parciais:

- `UNIQUE (userId, lessonId) WHERE projectId IS NULL`
- `UNIQUE (userId, lessonId, projectId) WHERE projectId IS NOT NULL`

`LessonProgress`, `LessonNote`, `LessonBookmark` e `LessonResponse` continuam por usuário e aula. Checkpoint é conceitual da aula. Atividade aplicada ao negócio ainda não carrega projeto.

## Consequência

A mesma aula pode ter um resultado pessoal e um por projeto, sem duplicar o progresso de leitura. Uma sprint futura pode ligar a atividade ao projeto sem reabrir o unique antigo.
