# Banco de dados

Status: a aplicação usa Postgres de desenvolvimento. A migration `20261009190000_auth_foundation` já foi aplicada nesse banco. Production ainda não tem banco próprio.

## Estado

Prisma 7, client em `src/generated/prisma`, gerado no `postinstall`. Além de `User`, `Session`, `Account` e `Verification`, a migration `20261010030000_education_foundation` criou curso, módulo, aula, bloco e o estado do aluno. Production continua sem banco próprio.

| Variável | Papel |
| --- | --- |
| `RUNTIME_DATABASE_URL` | Runtime, pooled. Única URL lida pelo client |
| `POSTGRES_URL` | Migrations e CLI, direta |
| `DATABASE_URL` | Mesma conexão direta. O código não lê |
| `PRISMA_DATABASE_URL` | Fora de runtime e de migration |
| `DATABASE_ENV` | `development` neste banco |

Não há `db push`. `npm run db:deploy` recusa production.

Antes de autenticar em production: banco separado, variáveis por ambiente na Vercel e migration versionada só nesse banco. O banco de desenvolvimento não deve ser reutilizado em production.

Pedido, pagamento, entitlement, projeto e diagnóstico continuam só no desenho abaixo. Não viraram tabela.

## Modelo conceitual

Sem schema definitivo. Agregados:

| Agregado | Entidades | Responsabilidade |
| --- | --- | --- |
| Identidade | `User`, `Session`, `Account`, `Verification` | Implementado na Sprint 1. Papel `USER` ou `ADMIN`. O restante deste desenho ainda não virou tabela |
| Aprendizado | `Course`, `Module`, `Lesson`, `LessonBlock` | Catálogo publicado na Sprint 2 |
| Estado do aluno | `LessonProgress`, `LessonBlockProgress`, `LessonResponse`, `LessonNote`, `LessonBookmark`, `LessonResult` | Leitura, resposta, nota, marcador e resultado. Não guarda pedido |
| Comercial | `Order`, `OrderItem`, `Payment` | Intenção de compra e transação |
| Acesso | `Entitlement` | Direito de abrir aula. Pode nascer de compra, crédito ou concessão |
| Crédito | lançamento ligado ao usuário | Valor já pago que pode abater upgrade. Não é entitlement |
| Projeto | `Project` | Contexto de negócio do aluno. Dono é o usuário |
| Prontidão | `Diagnostic`, `Recommendation` | Questionário e recomendações. Sem arquivo |
| Análise de mídia | `Upload`, `Analysis` | Arquivo privado e leitura desse arquivo |
| Operação | `Task`, `Reminder` | Plano Vivo. `Reminder` pode ser uma `Task` com prazo, para não haver dois agendadores |

Relacionamentos centrais:

- Curso tem módulos; módulo tem aulas. A aula também existe como item independente: a compra de uma aula não exige comprar o curso.
- Acesso efetivo à aula: entitlement direto da aula, ou entitlement do módulo que a contém, ou entitlement do curso que a contém.
- Progresso é por usuário e aula, não por pedido.
- `Payment` referencia `Order`. Vários registros de pagamento podem existir para a mesma ordem (tentativa, recusa, reembolso). Um pagamento aprovado é que libera entitlement.
- `Recommendation` aponta para diagnóstico ou análise, não para os dois ao mesmo tempo sem origem.
- `Upload` pertence a um `Project` ou a uma `Analysis`, nunca ao bloco público da aula.

Enums prováveis, ainda não criados: status da aula (`DRAFT`, `PUBLISHED`), tipo de produto (`LESSON`, `MODULE`, `COURSE`), status do pagamento (`PENDING`, `APPROVED`, `REJECTED`, `CANCELLED`, `REFUNDED`), origem do entitlement (`PURCHASE`, `CREDIT`, `GRANT`), tipo de bloco (lista em [content-model.md](./content-model.md)).

Simplificar na V1:

- Não criar tabela de “turma”, “matrícula” paralela ao entitlement, nem fórum.
- Não misturar `Order` com `Entitlement`.
- Não guardar CSV dentro de `LessonBlock`.
- Favorito pode ser um marcador em `LessonProgress` em vez de uma entidade própria, até existir um uso diferente de nota.

O que não misturar:

- Preço vigente do catálogo e preço cobrado. O item do pedido guarda o valor da época.
- Conteúdo público e arquivo do aluno.
- Resposta de diagnóstico e evento de analytics.
