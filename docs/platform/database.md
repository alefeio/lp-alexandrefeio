# Banco de dados

Status: development e production usam o mesmo Postgres físico. `DATABASE_ENV` identifica o runtime, não o banco. A decisão operacional está em [production-launch.md](./production-launch.md).

## Estado

Prisma 7, client em `src/generated/prisma`, gerado no `postinstall`. Além de `User`, `Session`, `Account` e `Verification`, a migration `20261010030000_education_foundation` criou curso, módulo, aula, bloco e o estado do aluno. A migration `20261010210000_project_diagnostic` criou `Project`, `Diagnostic` e `Recommendation`, e tornou `LessonResult.projectId` opcional com índices parciais. A migration `20261010220000_live_plan` criou `Task`, `Reminder` e `ProjectBudgetPlan`. A migration `20261011120000_commerce` criou pedido, item, snapshot de aulas, pagamento e entitlement, além de `commerceStatus`. Essas migrations atingem o banco compartilhado.

| Variável | Papel |
| --- | --- |
| `RUNTIME_DATABASE_URL` | Runtime, pooled. Única URL lida pelo client |
| `POSTGRES_URL` | Migrations e CLI, direta |
| `DATABASE_URL` | Mesma conexão direta. O código não lê |
| `PRISMA_DATABASE_URL` | Fora de runtime e de migration |
| `DATABASE_ENV` | Rótulo do runtime. `development` no local e `production` na Vercel podem apontar para este mesmo Postgres |

Não há `db push`. `npm run db:deploy` recusa o processo com `VERCEL_ENV=production`. Uma migration aplicada com `DATABASE_ENV=development` altera o schema que production usa. Revisar o SQL, a compatibilidade e o backup antes de aplicar.

Pedido, pagamento e entitlement existem no development. O desenho abaixo descreve o papel de cada agregado. Projeto e diagnóstico já são tabelas.

## Modelo conceitual

Sem schema definitivo. Agregados:

| Agregado | Entidades | Responsabilidade |
| --- | --- | --- |
| Identidade | `User`, `Session`, `Account`, `Verification` | Implementado na Sprint 1. Papel `USER` ou `ADMIN`. O restante deste desenho ainda não virou tabela |
| Aprendizado | `Course`, `Module`, `Lesson`, `LessonBlock` | Catálogo publicado na Sprint 2 |
| Estado do aluno | `LessonProgress`, `LessonBlockProgress`, `LessonResponse`, `LessonNote`, `LessonBookmark`, `LessonResult` | Leitura, resposta, nota, marcador e resultado. Não guarda pedido |
| Comercial | `Order`, `OrderItem`, `Payment` | Intenção de compra e transação |
| Acesso | `Entitlement` | Direito de abrir aula. Pode nascer de compra, crédito ou concessão |
| Crédito | cálculo no quote | Soma de `finalPriceCents` de pedidos pagos contidos no pacote. Não é tabela nem entitlement |
| Projeto | `Project` | Contexto de negócio do aluno. Dono é o usuário |
| Prontidão | `Diagnostic`, `Recommendation` | Questionário e recomendações. Sem arquivo |
| Análise de mídia | `Upload`, `Analysis` | Arquivo privado e leitura desse arquivo |
| Operação | `Task`, `Reminder` | Plano Vivo. `Reminder` pode ser uma `Task` com prazo, para não haver dois agendadores |

Relacionamentos centrais:

- Curso tem módulos; módulo tem aulas. A aula também existe como item independente: a compra de uma aula não exige comprar o curso.
- Acesso efetivo à aula paga: pelo menos um entitlement `ACTIVE` daquela aula. Módulo e curso concedem um entitlement por aula do snapshot.
- Progresso é por usuário e aula, não por pedido.
- `Payment` referencia `Order`. Vários registros de pagamento podem existir para a mesma ordem (tentativa, recusa, reembolso). Um pagamento aprovado é que libera entitlement.
- `Recommendation` aponta para diagnóstico ou análise, não para os dois ao mesmo tempo sem origem.
- `Upload` pertence a um `Project` ou a uma `Analysis`, nunca ao bloco público da aula.

Enums de conteúdo, pedido, pagamento e entitlement já existem na migration de comércio. Não há origem `PURCHASE` / `CREDIT` / `GRANT` no entitlement: a origem é o item do pedido. Tipos de bloco estão em [content-model.md](./content-model.md).

Simplificar na V1:

- Não criar tabela de “turma”, “matrícula” paralela ao entitlement, nem fórum.
- Não misturar `Order` com `Entitlement`.
- Não guardar CSV dentro de `LessonBlock`.
- Favorito pode ser um marcador em `LessonProgress` em vez de uma entidade própria, até existir um uso diferente de nota.

O que não misturar:

- Preço vigente do catálogo e preço cobrado. O item do pedido guarda o valor da época.
- Conteúdo público e arquivo do aluno.
- Resposta de diagnóstico e evento de analytics.
