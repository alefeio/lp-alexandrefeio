# Banco de dados

Status: o aplicativo não usa banco. Esta nota não altera schema.

## Estado neste repositório

Não existem:

- `prisma/schema.prisma`
- `prisma/migrations`
- seed
- `@prisma/client` ou `prisma` no `package.json`
- `PrismaClient`
- leitura de `DATABASE_URL` em `src/`

`README.md` diz que não há banco. Isso continua verdadeiro para o código.

## Variáveis locais

Nomes presentes só no `.env.local`, não versionados e não lidos pelo app:

- `DATABASE_URL` — host direto `db.prisma.io`
- `RUNTIME_DATABASE_URL` — host `pooled.db.prisma.io`
- `POSTGRES_URL` — host direto `db.prisma.io`
- `PRISMA_DATABASE_URL` — host direto `db.prisma.io`, esquema `postgres://`

Não há `DIRECT_URL` nem `DATABASE_ENV`. Não remover nada até a fundação ser implementada.

`PRISMA_DATABASE_URL`, neste arquivo, não é uma URL `prisma+postgres://`. Não deve ser tratada como Accelerate sem uma confirmação nova.

## Como o evolUSG separa as conexões

Padrão a copiar só depois que o banco deste produto estiver identificado:

| Função | Ordem |
| --- | --- |
| Runtime do client, inclusive serverless | `RUNTIME_DATABASE_URL`, senão `DATABASE_URL` |
| CLI e migrations | `DIRECT_URL`, senão `POSTGRES_URL`, senão `DATABASE_URL` |
| Fora dos dois caminhos | `PRISMA_DATABASE_URL` |

O client usa `@prisma/adapter-pg` (`PrismaPg`). Fora de `NODE_ENV=production`, a instância fica em `globalThis` para o hot reload não abrir conexões novas. Em produção cada isolate cria o seu client, que é o comportamento esperado em serverless, desde que a URL seja a pooled.

Migrations versionadas com `prisma migrate`. Sem `db push` como fluxo permanente. `migrate deploy` só com rótulo `development`, `preview` ou `test`, ou com confirmação explícita de produção numa sprint própria.

## Ambientes

| Ambiente | Intenção |
| --- | --- |
| Local | URL direta para migration; pooled se o runtime local for testado como serverless. Rótulo `development` |
| Preview | Banco próprio, não o de produção. Rótulo `preview` |
| Production | Runtime pooled. Migration direta, só quando a sprint de fundação autorizar |

Pendência: as quatro URLs locais podem ser de outro projeto Prisma Postgres ou de um banco já compartilhado. Não conectar nem migrar até isso ser confirmado. Não foi feita leitura do banco nesta sprint.

## Modelo conceitual

Sem schema definitivo. Agregados:

| Agregado | Entidades | Responsabilidade |
| --- | --- | --- |
| Identidade | `User` | Conta, papel (`student` ou `admin`). Sessão fica no mecanismo de auth, não neste agregado de negócio |
| Aprendizado | `Course`, `Module`, `Lesson`, `LessonBlock` | Catálogo e conteúdo publicado |
| Estado do aluno | `LessonProgress`, `LessonNote`, `LessonResult` | Leitura, nota e resultado. Não guarda pedido |
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
