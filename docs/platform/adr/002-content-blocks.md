# ADR 002 — Conteúdo em blocos

Status: ACCEPTED

## Contexto

As aulas da V1 são texto interativo, não vídeo e não um CMS genérico. O progresso do aluno precisa sobreviver a edição.

## Decisão proposta

A aula é uma lista de blocos tipados (`TEXT`, `HEADING`, `EXAMPLE`, `CALLOUT`, `CHECKPOINT`, `QUESTION`, `ACTIVITY`, `CHECKLIST`, `RESULT`, `CONCLUSION`). Cada bloco tem `blockKey` estável. Ordem é outro campo. Progresso, resposta e último bloco usam essa chave. Pixel de scroll não é persistido como progresso. Remover um bloco aposenta a chave.

## Consequência

O admin edita tipos conhecidos, não HTML livre. A Sprint 2 gravou os blocos no Postgres e valida o JSON com Zod. `QUESTION` não virou tipo: a pergunta fechada é `CHECKPOINT`. `IMAGE` existe no modelo, sem upload.

`TOOL` entrou depois, como referência genérica a uma ferramenta já existente. O diagnóstico de prontidão não virou um tipo de bloco próprio: a aula guarda só o vínculo com o `Diagnostic`. O brief de campanha também não virou tabela: o plano fica no `LessonResult` do projeto, e o bloco só aponta para `CAMPAIGN_BRIEF_V1`. O plano de destino e mensuração segue o mesmo caminho, apontando para `DESTINATION_MEASUREMENT_PLAN_V1`. O Blueprint de campanha de Pesquisa também fica no `LessonResult` do projeto, apontando para `SEARCH_CAMPAIGN_BLUEPRINT_V1`.
