# Sprint 6 — Operação editorial

Status: implementada. Comércio continua desligado. Nenhuma aula real foi marcada `AVAILABLE`.

## Workflow

O status do conteúdo continua `DRAFT` ou `PUBLISHED`. Não há um terceiro estado no banco.

- Rascunho: `DRAFT`. Fica fora do sitemap.
- Publicável: a checagem “Validar aula” não encontra pendência. Isso não publica e não vende.
- Publicado: `PUBLISHED`. Aula gratuita com corpo pode ser indexada. Aula paga publica o preview e o catálogo; o corpo continua protegido.

`PUBLISHED` não significa `AVAILABLE`.

## Blocos

O editor usa os tipos do ADR 002. Cada um tem formulário do schema Zod. `blockKey` é sugerida e pode ser revista antes da primeira gravação. Depois da publicação, trocar a chave exige confirmação: a chave antiga é aposentada e outra é criada. O progresso não migra.

A ordem é `position`. Reordenar não apaga progresso. Em aula publicada, ou quando a chave já tem progresso, retirar o bloco grava `retiredAt`. Em rascunho sem progresso, nota ou marcador, a exclusão pode ser física.

## Preview

`/admin/aulas/[id]/preview` renderiza o leitor real. Há atalho para 320px. Só ADMIN chega nessa rota. A tela não grava progresso e não dispara `lesson_started`, `lesson_progress` nem `lesson_completed`. Não existe query pública que abra o corpo pago.

## APIMG e MediaAsset

O browser envia o arquivo para a Server Action. A action exige ADMIN, confere JPEG, PNG ou WebP pelos bytes e recusa acima de 5 MB. O serviço documenta 10 MB; 5 MB fica dentro desse limite. SVG não entra.

A action chama `POST` com `X-API-Key`. A resposta vira `MediaAsset`: `url`, `publicId`, largura, altura, formato, tamanho, alt e o marcador decorativo. Imagem de conteúdo precisa de alt ou ser marcada como decorativa. O alt não é gerado por IA.

APIMG é só asset editorial público. CSV, XLSX e PDF de aluno continuam fora. O ADR de storage privado segue pendente.

## Prontidão e venda

Uma aula paga fica tecnicamente pronta com título, resumo, preview público, minutos, preço válido, bloco de conteúdo, resultado, conclusão, payloads válidos e imagem com alt ou decorativa. Aula gratuita não exige resultado nem preço.

Passar nessa checagem não marca `AVAILABLE`. “Disponibilizar para venda” é outra ação. Ela exige aula publicada, paga, pronta e com preço. Módulo e curso só passam quando todas as aulas pagas daquele pacote estão publicadas e `AVAILABLE`. Nesta sprint essa ação não foi executada no curso real.

## Importação

Uma aula pode ser exportada e reimportada em JSON com `schemaVersion: 1` e o `lessonId`. A validação mostra o que criaria ou atualizaria antes de gravar. Arquivo de outra aula é recusado. Blocos que faltam no arquivo permanecem. Word e PDF não entram.

## Seed

O seed segue como bootstrap. Se a aula já tem blocos, ele não reescreve o conteúdo. O update continua só recolocando `commerceStatus` em `NOT_FOR_SALE`, sem apagar texto nem mudar preço.

## Concorrência

Salvar devolve erro se o `updatedAt` da aba for mais antigo. Não há editor colaborativo nem histórico completo. `updatedAt`, `publishedAt` e `updatedById` registram a última gravação.
