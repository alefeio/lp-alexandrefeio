# Sprint 4 — plano vivo, tarefas e lembretes

Base: `a8169f3`. Banco: somente development. Migration `20261010220000_live_plan`.

Não há entidade `Plan`. A página `/app/projetos/[id]/plano` lê o projeto, o último diagnóstico, as recomendações, as tarefas, os lembretes e o planejamento de saldo.

## Próxima ação

1. Tarefa alta e vencida.
2. Qualquer tarefa vencida.
3. Tarefa alta com o prazo mais próximo.
4. Tarefa em andamento.
5. Tarefa a fazer, por prioridade e depois por prazo.
6. Recomendação sem tarefa ativa. Alta vem antes. `WAIT` não vira tarefa.
7. Lembrete de revisão nos próximos 7 dias.
8. Convite ao diagnóstico, se ainda não houver um concluído.
9. Nenhuma ação operacional. “Continuar estudando” permanece em outro bloco de `/app`.

## Recommendation e Task

“Adicionar ao meu plano” cria uma tarefa ligada à recomendação. Uma recomendação só tem uma tarefa `TODO` ou `IN_PROGRESS`. O índice parcial impede a duplicata. Concluir a tarefa não apaga a recomendação.

`WAIT` oferece “Lembrar-me de revisar” e cria um `Reminder` `REVIEW`.

Uma aula futura pode criar tarefa `LESSON` com `lessonResultId`, se o resultado já pertence ao projeto.

## Reminder

Um aviso em uma data. Sem recorrência. Disponível na área quando `remindAt` já chegou e `dismissedAt` está vazio. Lido grava `readAt`. Dispensar grava `dismissedAt`. Os dois são independentes; dispensar também marca como lido se ainda não estava.

O e-mail usa um template próprio, só se `emailEnabled`. O corpo leva o título, o nome do projeto e o link do plano. `emailSentAt` só é gravado depois do envio aceito. Rodar de novo não reenvia.

`POST /api/cron/reminders` exige `Authorization: Bearer CRON_SECRET`. Sem o segredo, responde 503. Não há agendamento de production.

Para ligar depois: banco de production separado, variáveis desse ambiente, migrations, `CRON_SECRET`, só então o scheduler, e um teste de fumaça.

## Orçamento

Um `ProjectBudgetPlan` por projeto. Cobertura = `Math.floor(saldo / valor diário)`. O dia incompleto não conta. Valor diário zero é recusado. Ao salvar, os lembretes `BUDGET` ainda ativos são dispensados e nasce um só, com a nova previsão. A tela diz que a estimativa usa os valores informados, não o saldo do Google ou da Meta.

## Projeto arquivado

Não aceita tarefa, lembrete nem planejamento novo. O plano continua visível. Lembretes futuros ainda não dispensados recebem `dismissedAt`. O envio de e-mail ignora projeto arquivado.

## Fora desta sprint

Pagamento, upload, IA, APIs de anúncio, calendário, kanban e recorrência.
