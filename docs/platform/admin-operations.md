# Admin operacional

Visão somente leitura para acompanhar cadastro, estudo, projeto, diagnóstico e compra. Não é CRM, não impersona o aluno e não altera pedido, pagamento, entitlement ou resposta educacional.

O banco de desenvolvimento e o de produção são o mesmo PostgreSQL. Esta área não cria migration nem grava registro.

## Páginas

| Rota | Uso |
| --- | --- |
| `/admin` | Contagens e jornada |
| `/admin/usuarios` | Lista paginada, busca e filtros |
| `/admin/usuarios/[id]` | Detalhe operacional de uma pessoa |
| `/admin/compras` | Pedidos, com link para a pessoa |
| `/admin/compras/[id]` | Pedido, itens e pagamentos |
| `/admin/cursos` e rotas editoriais | Administração de conteúdo, preservada |

A navegação é Visão geral, Usuários, Compras e Cursos. As rotas de módulo e aula continuam a partir de Cursos.

## Segurança

`requireAdmin` resolve a sessão no servidor e só libera `role === ADMIN`. Sem sessão, o acesso vai para `/entrar`. Com sessão de aluno, a área mostra “Sem acesso”. O papel enviado pelo navegador não é consultado.

Todas as páginas em `/admin` usam `noindex` e `nofollow`. `/admin` também está fora do sitemap e bloqueado em `robots.txt`.

O admin não envia evento ao GTM. Nome, e-mail, identificador, projeto, diagnóstico, progresso individual e compra individual não entram em analytics.

## Métricas da visão geral

| Card | Definição |
| --- | --- |
| Cadastrados | Quantidade de `User` |
| E-mail verificado | `User.emailVerified = true`, o booleano do Better Auth |
| Aulas iniciadas | Quantidade de registros `LessonProgress` |
| Aulas concluídas | `LessonProgress` com `completedAt` |
| Projetos criados | Quantidade de `Project` |
| Diagnósticos concluídos | `Diagnostic` com status `COMPLETED` |
| Pedidos | Quantidade de `Order`, em qualquer status |
| Pagamentos aprovados | `Payment` com status `APPROVED` |
| Receita recebida | Soma líquida descrita abaixo |

Não há métrica de aluno ativo, conversão ou retenção.

Aulas iniciadas e concluídas nos cards contam registros de progresso. A jornada abaixo conta pessoas distintas. Os dois números não são a mesma coisa.

## Receita recebida

Entra na soma apenas pagamento `APPROVED` ou `PARTIALLY_REFUNDED`.

O valor de cada um é `max(0, amountCents - refundedAmountCents)`.

Ficam de fora `PENDING`, `IN_PROCESS`, `REJECTED`, `CANCELLED`, `REFUNDED` e `CHARGED_BACK`. Um reembolso total nesses status não permanece na receita, mesmo que `refundedAmountCents` continue zero.

`R$ 0,00` é o estado válido enquanto não houver pagamento aprovado. O total do pedido não é usado como receita.

## Jornada

Somente contagens, sem percentual.

| Etapa | Definição |
| --- | --- |
| Cadastrados | Usuários |
| Iniciaram aula | Usuários distintos com algum `LessonProgress` |
| Concluíram aula | Usuários distintos com algum `LessonProgress.completedAt` |
| Fizeram diagnóstico | Usuários distintos com `Diagnostic` `COMPLETED` |
| Compraram | Usuários distintos com `Order` `PAID` |

## Lista de usuários

A página pede 20 usuários por vez, no servidor. A busca olha nome e e-mail, sem diferenciar maiúsculas, e não percorre respostas de aula.

Filtros: Todos, Verificados, Não verificados, Com aprendizado, Com diagnóstico e Com compra.

Com aprendizado significa algum `LessonProgress`. Com diagnóstico significa qualquer `Diagnostic`, inclusive em andamento. Com compra significa qualquer `Order`, inclusive não pago. O card de diagnósticos concluídos e a etapa “Compraram” continuam mais estritos.

## Última atividade

Estimativa operacional. É a data mais recente entre os campos que já existem:

- `Session.updatedAt`
- `LessonProgress.updatedAt`
- `LessonResponse.updatedAt`
- `LessonResult.updatedAt`
- `Project.updatedAt`
- `Diagnostic.updatedAt`
- `Order.updatedAt`

Não há coluna nova, não há tracking de page view e um campo ausente não é inventado. Sem nenhum desses registros, a interface mostra “Sem registro”.

## Detalhe

O cabeçalho mostra nome, e-mail, verificação, cadastro e última atividade.

Aprendizado lista aulas publicadas, com percentual, status, último bloco e data de conclusão quando existem. “Não iniciada” é ausência de progresso. Em aula paga, “Sem acesso”, “Entitlement ativo” e “Acesso revogado” aparecem à parte.

Respostas não são exibidas. Só a contagem e se existe resultado prático, com o nome humano do resultado. O diagnóstico da aula de prontidão continua sendo `Diagnostic`, não `LessonResult`.

Projetos mostram nome, ativo ou arquivado, criação e atualização. O detalhe abre na própria tela. Não há editor administrativo de projeto.

Cada projeto mostra o último diagnóstico com data, versão, status, score, gargalo e a recomendação principal gerada pelo sistema. O histórico resume data, score e gargalo. As respostas do diagnóstico não aparecem.

Tarefas, quando existem, mostram até oito itens, priorizando as abertas: título, status, origem e prazo. O admin não conclui tarefa.

Lembretes aparecem só como contagem de ativos e data do próximo.

Compras listam pedido, data, produto, valor, status e, no pagamento, status, provedor e valor. Sem compra, o texto é “Nenhuma compra realizada.”

Acessos listam cada entitlement, com aula, origem da compra, ativo ou revogado e data. Fontes diferentes da mesma aula permanecem visíveis.

## O que não aparece

Senha, hash, token de sessão, segredo de provedor, respostas completas, JSON de resultado, respostas do diagnóstico, orçamento do projeto, identificador de pagamento no provedor, chave de idempotência, token de cartão, CVV e dados completos do instrumento.

## Limitações da V1

- Não aprova pagamento, não estorna, não cria nem revoga acesso e não edita pedido.
- Não entra na conta do aluno.
- Não atribui pessoa a anúncio e não grava GCLID.
- Não calcula conversão.
- A receita depende do status do pagamento e de `refundedAmountCents`. Um estorno que não atualize nenhum dos dois continuaria contado.
- A última atividade ignora visualização de página sem registro nos modelos acima.
- A lista de compras mostra os 50 pedidos mais recentes.
