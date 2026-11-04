# Painel de jornada

Leitura interna em `/admin/jornada`. Não há API pública. A página exige administrador e consulta o banco só no servidor.

O início oficial da análise é `2026-10-26T17:42:00.000Z` (`PRODUCT_JOURNEY_REPORTING_START_AT`). Eventos anteriores, inclusive o smoke técnico, continuam armazenados e ficam fora de todos os recortes, também em “Todo o período”. Nada é apagado para limpar o painel.

O marco da UX-C em Production é `2026-11-03T16:32:04.000Z` (`UX_C_PRODUCTION_AT`), o merge do PR #14 (`9f6a2e8ee4782734654dd9a94c63f75065771de1`). Não é um horário de deploy lido fora do Git. A leitura padrão mostra só o que veio a partir desse instante. “Antes da UX-C” fica entre o início da análise e o marco, sem incluí-lo. “Períodos juntos” identifica os dois lados quando o período cruza o marco. Uma jornada pode aparecer nos dois lados; os números não devem ser somados nem lidos como comparação de desempenho. Se o período escolhido fica inteiro antes ou depois do marco, os cartões permanecem nesse lado e a divisão não aparece.

As datas da interface usam `America/Belem`. As consultas continuam em UTC.

## O que cada fonte responde

JourneyEvent descreve o caminho de quem consentiu analytics. Pedido, pagamento, progresso de aula e diagnóstico confirmam o que aconteceu de fato.

| Conceito | Definição |
| --- | --- |
| Jornada identificada | `anonymousId` distinto. É um navegador/perfil com consentimento e pode não ser uma pessoa única. |
| Usuário autenticado observado | `userId` distinto quando o campo existe. O mesmo usuário em dois navegadores conta como duas jornadas e um usuário. |
| Sessão de jornada | `sessionId` distinto da plataforma. Não é a sessão do GA4. |
| Pedido pago | `Order.status = PAID` com `createdAt` no período. `purchase_completed` não é a contagem de vendas. |
| Receita recebida | Mesma regra do admin operacional: pagamentos `APPROVED` e `PARTIALLY_REFUNDED`, líquidos de `refundedAmountCents`, pela data de aprovação ou, se ela não existir, pela criação. Só na visão de todos os cursos. |
| Valor dos itens do curso | Soma de `finalPriceCents` dos itens pagos da formação. Não rateia o pagamento inteiro. |
| Origem observada | Atribuição do primeiro JourneyEvent daquele `anonymousId` no período selecionado. Não é a atribuição definitiva da venda. GA4 segue como ferramenta de marketing avançado. |
| Aprendizado operacional | Usuários distintos em `LessonProgress`, por início e por conclusão. |
| Diagnóstico operacional | Usuários distintos em `Diagnostic` com status `COMPLETED`. A tabela não tem curso; no filtro de uma formação esse número fica oculto. |

## Leitura correta

Cada marco conta jornadas que alcançaram aquele evento no período. Não é um funil fechado e não há taxa de conversão entre etapas.

A cobertura “X de Y” compara compradores do pedido pago com quem também tem `purchase_completed` autenticado. Mede cobertura do analytics consentido. Abaixo de 100% não é erro: quem recusa analytics pode comprar sem JourneyEvent. O evento de compra pode chegar sem slug de curso; nesse caso ele entra na visão geral e não na visão de uma formação.

Home e catálogo não são o mesmo clique. O movimento entre formações só usa `course_complementary_click`.

A maturidade da leitura é operacional, não estatística: 1 a 19 jornadas pedem checagem da coleta; 20 a 49, hipóteses iniciais; 50 a 99, padrões com cautela; 100 ou mais, aprofundamento se a amostra for representativa. O painel não declara qual curso converte mais.

Clique de caminho, acesso à aula gratuita, evento `lesson_started` e aluno com `LessonProgress` são contagens diferentes. O CTA de curso (`course_cta_click`) não entra no PostgreSQL.

## Limites desta versão

Não há exportação, jornada individual, coorte, atribuição multi-toque nem atualização em tempo real. Não foi criada tabela, visão materializada nem migration.
