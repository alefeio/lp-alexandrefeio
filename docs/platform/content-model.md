# Aulas textuais e progresso

Status: implementado na Sprint 2. O leitor está em `/aulas/[slug]`. Ainda não há editor no admin.

## Forma da aula

A aula é um documento ordenado de blocos, não um HTML livre e não um page builder. Tipos estáveis da V1:

`TEXT`, `HEADING`, `CALLOUT`, `EXAMPLE`, `CHECKPOINT`, `ACTIVITY`, `CHECKLIST`, `RESULT`, `CONCLUSION`, `IMAGE`.

Cada bloco tem uma chave opaca definida na publicação (`blockKey`), única dentro da aula. A ordem de exibição é um campo separado. Reordenar não muda a chave. Apagar um bloco aposenta a chave; não a reutiliza para outro conteúdo.

O corpo do bloco é JSON validado por tipo. Isso evita um CMS de nós arbitrários. Não há bloco “HTML cru” na V1.

## O que o aluno guarda

| Dado | Chave | Observação |
| --- | --- | --- |
| Último bloco | `userId + lessonId` | Guarda `blockKey`, não índice nem pixel |
| Progresso | `userId + lessonId + blockKey` | Bloco visto ou concluído |
| Resposta | mesma chave de progresso, ou filha | Só para `CHECKPOINT`, `ACTIVITY`, `CHECKLIST` |
| Nota | `userId + lessonId`, com `blockKey` opcional | Texto do aluno, privado |
| Marcador | `userId + lessonId + blockKey` | `LessonBookmark`. Não é o mesmo que concluir o bloco |
| Resultado da aula | `userId + lessonId`, com `projectId` opcional | Sem projeto, é o resultado pessoal. Com projeto, a mesma aula pode ter um resultado por negócio. Ver ADR 006 |

Scroll em pixels não é fonte de progresso. Pode existir como detalhe de interface, sem ser persistido como verdade.

## Alterar a aula sem apagar o aluno

- Chave estável: o estado sobrevive a edição de texto e a troca de ordem.
- Bloco novo nasce sem progresso. Não reescreve blocos antigos.
- Bloco removido: o registro do aluno fica órfão e deixa de entrar no cálculo. Não é reassociado por posição.
- Conclusão da aula usa as chaves publicadas no momento, não o histórico de chaves aposentadas.
- Trocar o tipo de um bloco existente é uma chave nova. A chave antiga se aposenta.

## Independência

A aula não exige a anterior para existir, ser comprada ou ser lida. Pré-requisito, se um dia existir, é regra de produto explícita, não uma consequência da ordem do módulo.

## Admin mínimo

Criar aula, ordenar blocos, editar JSON do tipo, publicar. Sem versionamento completo de CMS na V1. A chave publicada é o contrato com o progresso.
