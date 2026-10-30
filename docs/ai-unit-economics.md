# Custo estimado de API

O ledger mede o custo estimado de API baseado no usage retornado pelo provedor. Ele não é a fatura do provedor.

## AI action e provider call

Uma AI action é a solicitação lógica do produto. O `requestId` a identifica.

Uma provider call é cada `responses.create()` efetivamente executado. O par `requestId` + `attempt` é único. Uma ação pode ter várias chamadas: a primeira, um repair da aplicação ou um retry interno depois de erro transitório. Cada uma entra no ledger com os próprios tokens e o próprio custo estimado.

## Tokens e preço

Os tokens vêm do `usage` da resposta. O preço vem do catálogo versionado em `src/lib/ai/pricing.ts`, conferido em 2026-10-30 para `gpt-6-luna` em `https://developers.openai.com/api/docs/models/gpt-6-luna`. O código não busca essa página em runtime.

Cada registro congela `pricingVersion` e `estimatedCostUsdMicros` (1 USD = 1.000.000 micros). Uma mudança futura de preço cria outra `pricingVersion` e não recalcula o passado. Não há base confiável para reconstruir consumo anterior a esta instrumentação.

`reasoningTokens` já estão dentro de `outputTokens` e não são cobrados de novo.

## Unpriced

`estimatedCostUsdMicros = null` significa que a chamada não teve custo calculado. Acontece quando o usage não veio, quando o modelo não está no catálogo, ou quando há `cacheWriteTokens` sem a divisão entre escrita de 30 minutos e de 12 horas. O ledger ainda guarda o modelo e os tokens conhecidos. Não se aplica o preço do Luna a outro modelo.

## Retry

Erro transitório do provedor e repair da aplicação são chamadas separadas. As duas permanecem mesmo que a copy final seja rejeitada. O status da provider call diz se o provedor respondeu ou se a chamada falhou antes de uma resposta. A aceitação da copy pela aplicação não apaga o custo.

## Privacidade

O registro guarda contexto operacional: usuário, projeto, curso, landing page, tipo de seção, versão do prompt, provedor, modelo, tokens, status, código de erro e latência. Não guarda prompt, instruções, fatos do aluno, copy, rascunho, resposta bruta, chain of thought, e-mail, nome ou segredo. A exclusão da conta remove os registros desse usuário, como as demais relações da conta.

Se a gravação do ledger falhar, a copy gerada não é descartada. O servidor registra apenas `requestId`, `attempt` e `featureKey`.

## Novo modelo

Adicione a tabela de preços em `src/lib/ai/pricing.ts` com uma nova `pricingVersion`. Não reaproveite a versão anterior. Modelos ausentes continuam funcionando e ficam `unpriced`.
