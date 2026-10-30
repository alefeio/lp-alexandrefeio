# Custo estimado de API

O ledger mede o custo estimado de API baseado no usage retornado pelo provedor. Ele não é a fatura do provedor.

## AI action e provider call

Uma AI action é a solicitação lógica do produto. O `requestId` a identifica.

Uma provider call é cada `responses.create()` efetivamente executado. O par `requestId` + `attempt` é único. Uma ação pode ter várias chamadas: a primeira, um repair da aplicação ou um retry interno depois de erro transitório. Cada uma entra no ledger com os próprios tokens e o próprio custo estimado.

## Tokens e preço

Os tokens vêm do `usage` da resposta. A escrita de cache é lida em `input_tokens_details.cache_write_tokens` e a divisão em `cache_write_tokens_details.ttl_30m_tokens` e `ttl_12h_tokens`. O preço vem do catálogo versionado em `src/lib/ai/pricing.ts`, conferido em 2026-10-30 para `gpt-6-luna` em `https://developers.openai.com/api/docs/models/gpt-6-luna`. O código não busca essa página em runtime.

A versão atual do cálculo é `openai-2026-10-30-v2`. Ela congela tier Standard, cache aninhado e long-context. Cada registro guarda `pricingVersion` e `estimatedCostUsdMicros` (1 USD = 1.000.000 micros). Uma mudança futura de preço cria outra versão e não recalcula o passado.

`reasoningTokens` já estão dentro de `outputTokens` e não são cobrados de novo.

## Service tier

O ledger grava `service_tier` devolvido pela resposta, não o valor pedido. Só `default` usa a tabela Standard. `flex`, `priority`, `scale`, `auto`, `ultrafast` e ausência de tier ficam sem preço. `auto` não é tratado como Standard, porque descreve o pedido e não o tier efetivo.

## Long-context

Para `gpt-6-luna`, input acima de 272.000 tokens usa o cartão long-context na request inteira: o dobro do input e do cache, e 1,5 vez o output. O limite de 272.000 inclusive permanece no cartão curto. Não se aplica o preço curto acima desse limite.

## Unpriced

`unpriced` significa “não calculado com segurança”, não “gratuito”. `estimatedCostUsdMicros = null` não é custo zero. Acontece sem usage, com modelo fora do catálogo, com tier que não seja `default`, ou quando `cacheWriteTokens` não fecha com a soma dos TTLs. O ledger ainda guarda modelo, tier e tokens conhecidos.

## Retry

Erro transitório do provedor e repair da aplicação são chamadas separadas. As duas permanecem mesmo que a copy final seja rejeitada. O status da provider call diz se o provedor respondeu ou se a chamada falhou antes de uma resposta. A aceitação da copy pela aplicação não apaga o custo.

## Privacidade

O registro guarda contexto operacional: usuário, projeto, curso, landing page, tipo de seção, versão do prompt, provedor, modelo, tokens, status, código de erro e latência. Não guarda prompt, instruções, fatos do aluno, copy, rascunho, resposta bruta, chain of thought, e-mail, nome ou segredo. A exclusão da conta remove os registros desse usuário, como as demais relações da conta.

A observação de cada `responses.create()` fica em memória durante a chamada ao provedor. A gravação no banco acontece depois, com timeout próprio de 1 segundo. Se o ledger atrasar, falhar ou não responder, a copy já obtida continua sendo entregue. O servidor registra apenas `requestId`, `attempt` e `featureKey`.

## Novo modelo

Adicione a tabela de preços em `src/lib/ai/pricing.ts` com uma nova `pricingVersion`. Não reaproveite a versão anterior. Modelos ausentes continuam funcionando e ficam `unpriced`.
