# Sprint 3 — projeto e diagnóstico de prontidão

Base: `90358cb`. Banco: somente development. Migration `20261010210000_project_diagnostic`.

## O que entrou

`Project` é o contexto de um negócio do aluno. A criação pede o nome. Segmento, oferta, objetivo, canais, destino, orçamento em centavos, ticket, site e área de atendimento entram depois. Status `ACTIVE` ou `ARCHIVED`.

`Diagnostic` guarda a versão `traffic-readiness-v1`, respostas validadas, notas, gargalo, snapshot e o passo atual. Um diagnóstico novo não altera o anterior. `IN_PROGRESS` é retomado; `COMPLETED` fica no histórico.

`Recommendation` nasce na conclusão. Não é tarefa. Pode apontar para uma `Lesson` já publicada. Aula paga continua como “Disponível em breve”.

## Nota

Cada dimensão é `Math.round(pontos / máximo × 100)`.

A nota geral é `Math.round((objetivo×10 + oferta×20 + cliente×10 + destino×20 + mensuração×20 + operação×20) / 100)`.

`Math.round` arredonda metade para cima. Orçamento baixo não reduz a nota. Instagram e WhatsApp como destino também não.

Faixas: 80–100 ajustes pontuais; 60–79 base com pontos importantes; 40–59 preparação incompleta; 0–39 fundamentos antes de investir mais. Nenhuma faixa promete resultado.

## Gargalo

A nota geral não esconde um problema crítico.

- Objetivo: Q1 “ainda não sei” ou Q2 “não”.
- Oferta: Q3 “não”.
- Cliente: Q6 “não”.
- Destino: Q8 “ainda não defini”, Q9 “não” ou Q9 “não sei avaliar”.
- Mensuração: Q11 “não”, Q12 “não possuo” ou Q12 “não sei”.
- Operação: Q14 “não existe processo definido”.

Se houver mais de um, a ordem é objetivo, oferta, cliente, destino, mensuração, operação. A ideia é não pedir pixel antes de existir o que anunciar. Se não houver crítico e todas as dimensões estiverem em 80 ou mais, não há gargalo principal.

## Canal

Q7 “já procura” sugere Google Ads. “Precisa descobrir” sugere Meta Ads. “Os dois” sugere ambos. “Não sei” não sugere canal. Objetivo no WhatsApp não escolhe Meta. O texto deixa claro que mercado, orçamento e oferta também importam.

## LessonResult

Progresso, nota, marcador e checkpoint continuam por usuário e aula. `LessonResult` ganhou `projectId` opcional. A migration troca o unique simples por dois índices parciais: um resultado pessoal (`projectId` nulo) e um por projeto. O leitor desta sprint continua gravando o resultado pessoal. A resposta de atividade aplicada ainda não tem projeto; essa ligação fica para quando uma atividade passar a pertencer a um negócio. Ver `docs/platform/adr/006-lesson-result-project.md`.

O client do Prisma fica em `globalThis` também no servidor de produção, para não abrir uma conexão nova a cada request.

## Fora desta sprint

IA, upload, pagamento, Plano Vivo, tarefas, alertas, APIs de anúncio, segundo curso, blog, APIMG e storage privado.
