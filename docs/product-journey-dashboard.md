# Painel de jornada

Leitura interna em `/admin/jornada`. Não há API pública. A página exige administrador e consulta o banco só no servidor.

O início oficial da análise é `2026-10-26T17:42:00.000Z` (`PRODUCT_JOURNEY_REPORTING_START_AT`). Eventos anteriores, inclusive o smoke técnico, continuam armazenados e ficam fora de todos os recortes, também em “Todo o período”. Nada é apagado para limpar o painel.

A UX-C entrou em Production em `2026-11-03T16:33:05Z` (`UX_C_PRODUCTION_AT`). A evidência é o deployment GitHub `7524578070`, ambiente Production, estado `success`, descrição “Deployment has completed”, no SHA `9f6a2e8ee4782734654dd9a94c63f75065771de1` (merge do PR #14). O filtro padrão é Pós-UX-C e consulta só a partir desse instante. “Histórico disponível” usa a janela já existente do painel, desde o início oficial, e inclui o que veio depois do marco. Os dois contextos não são uma comparação automática. Se o período termina antes do marco, Pós-UX-C informa que não há intervalo, sem percentual de crescimento.

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

A maturidade usa o total de jornadas do recorte, não a barra mais alta de uma seção: 1 a 19 pedem checagem da coleta; 20 a 49, hipótese inicial; 50 a 99, padrões com cautela; 100 ou mais, leitura mais fundo, com ressalva de representatividade. Essas faixas não são teste de significância. O aviso aparece uma vez. O painel não declara qual curso converte mais.

Clique de caminho, início observado de aula gratuita, evento `lesson_started` e usuário com `LessonProgress` são contagens diferentes. O CTA de curso (`course_cta_click`) não entra no PostgreSQL e não aparece como zero interno.

## Limites desta versão

Não há exportação, jornada individual, coorte, atribuição multi-toque nem atualização em tempo real. Não foi criada tabela, visão materializada nem migration.
