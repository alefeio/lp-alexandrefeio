# Sprint 5 — Comércio, acesso e upgrade

Base: `13c4efa`. Migration `20261011120000_commerce`, só no Postgres de development.

O comércio nasce fechado. Nesta sprint ele só abre quando, ao mesmo tempo, `COMMERCE_ENABLED=true`, `MERCADO_PAGO_ENV=test`, `DATABASE_ENV=development`, a chave pública, o access token e o segredo do webhook estão presentes, e `VERCEL_ENV` não é production.

## Gate 5.0

`MERCADO_PAGO_ENV=test` declara que as chaves deste ambiente saíram da seção Credenciais de teste da aplicação no painel do Mercado Pago. No Checkout Transparente via Orders, o access token de teste também pode começar com `APP_USR`. O prefixo não é checagem de segurança e não decide o ambiente. Sem as variáveis acima, o Brick não cobra e o webhook responde 503. A aba Credenciais de produção não entra nesta sprint.

## Catálogo

`accessType` e `commerceStatus` são coisas diferentes.

| Campo | Significado |
| --- | --- |
| `FREE` | Aula publicada abre sem compra |
| `PAID` | Exige compra quando a venda existir |
| `NOT_FOR_SALE` | Não pode ser cobrada |
| `AVAILABLE` | Pode ser cobrada agora |

O conteúdo pago real desta sprint permanece `NOT_FOR_SALE`. O seed grava esse estado de novo. Módulo e curso só entram no quote se cada aula paga da composição estiver publicada, `PAID`, `AVAILABLE` e com preço inteiro maior que zero. O curso completo não fica `AVAILABLE` só porque o preço `24990` existe.

## Modelos

Dinheiro em centavos inteiros, moeda `BRL`. Não há carrinho no banco.

| Modelo | Papel |
| --- | --- |
| `Order` | Intenção fechada. Estados: `PENDING_PAYMENT`, `PAID`, `CANCELLED`, `REFUNDED`, `NEEDS_REVIEW` |
| `OrderItem` | Snapshot de um produto: aula, módulo ou curso. Exatamente um id preenchido, com `CHECK` `order_item_one_product` |
| `OrderItemLesson` | Aulas incluídas naquele item na hora da compra |
| `Payment` | Tentativa no Mercado Pago. Várias por pedido |
| `Entitlement` | Direito de uma aula. Estados: `ACTIVE`, `REVOKED` |

`Payment` guarda `PENDING`, `IN_PROCESS`, `APPROVED`, `REJECTED`, `CANCELLED`, `REFUNDED`, `PARTIALLY_REFUNDED` e `CHARGED_BACK`. Status desconhecido do provider não vira aprovado: o pedido vai para `NEEDS_REVIEW`.

## Carrinho e quote

O navegador guarda só `{ type, id }` em `af_cart_v1`. Login é obrigatório em `/app/carrinho` e `/app/checkout`. O servidor recalcula preço, crédito e total na cotação e de novo ao criar o pedido.

Um checkout aceita várias aulas ou um único pacote. Misturar curso, módulo e aula no mesmo pedido é recusado. Não cobra duas vezes o mesmo conteúdo no mesmo pedido. Se todas as aulas do alvo já têm entitlement ativo, a resposta é que o conteúdo já foi adquirido.

## Crédito de upgrade

O crédito é a soma de `OrderItem.finalPriceCents` de pedidos `PAID` cujas aulas do snapshot estão todas dentro do pacote. Não usa o preço de lista de hoje. Não é carteira, não saca e não vale em outro curso.

Exemplo: aula paga a R$ 39,90 e módulo complementar pago a R$ 64,00 geram R$ 103,90 de crédito no curso, não R$ 39,90 mais o preço cheio do módulo.

`total = max(0, preço alvo - crédito elegível)`. Pedido reembolsado ou em `NEEDS_REVIEW` não entra no crédito. A V1 prefere reembolso integral.

Se o crédito cobre o pacote e ainda falta aula, o pedido nasce `PAID` com `totalCents = 0` e `zeroValueUpgrade`. Não existe `Payment` externo de R$ 0.

## Acesso

Aula `FREE` publicada abre sem entitlement. Aula `PAID` abre se existir ao menos um entitlement `ACTIVE` daquela aula para o usuário. O corpo pago só é lido depois dessa decisão. Comprar módulo ou curso cria um entitlement por aula do snapshot. Aula acrescentada depois não entra na compra antiga.

Duas compras podem cobrir a mesma aula. Reembolsar uma revoga só os entitlements daquela ordem. A outra fonte mantém o acesso.

## Mercado Pago

Payment Brick (`@mercadopago/sdk-react`) no checkout, com cartão de crédito e Pix (`bankTransfer`). O tipo do SDK lista um meio por vez; o objeto enviado habilita os dois, com no máximo 3 parcelas. Não há boleto, débito, carteira Mercado Pago nem promessa de parcelamento sem juros. O teto de 3 vale para qualquer valor. As condições de juros são as do provider.

A cobrança é `POST /v1/orders` do Checkout Transparente, com `processing_mode: automatic`. O id guardado é o da order (`ORD…`). A consulta e o webhook usam `GET /v1/orders/{id}`. Status `processed` / `accredited` vira aprovado. Pix nasce `action_required` / `waiting_transfer` e não libera acesso. `failed` é recusa. Contestação `charged_back` / `settled` revoga. Em teste, o e-mail enviado ao provider é `test@testuser.com`, o único aceito na documentação de compra de teste. O e-mail da conta não vai nessa chamada.

O cartão fica no Brick. O servidor recebe método, token, parcelas e identificação só para criar a order, e não grava esses campos. O QR do Pix é lido de novo na order. Não fica no banco.

Cada tentativa nova tem `idempotencyKey` própria, enviada em `X-Idempotency-Key`. A mesma tentativa em aberto reutiliza a chave. Um clique repetido em menos de 20 segundos não abre outra cobrança. `external_reference` é o id do pedido, nunca o usuário.

`POST /api/webhooks/mercado-pago` confere `x-signature`, `x-request-id` e `data.id` com HMAC do manifesto `id;request-id;ts`. O `data.id` alfanumérico entra em minúsculas. Assinatura inválida responde 401. Só o tópico `order` segue para a consulta. Notificação com `live_mode: true` recebe 200 e não libera acesso. O corpo não libera acesso. A função `reconcileMercadoPagoPayment` consulta a order no provider. O botão “Atualizar status” e um intervalo de 15 segundos, no máximo 8 vezes, usam a mesma função.

Aprovação, na primeira vez, marca o pagamento, marca o pedido `PAID` e cria os entitlements na mesma transação. Webhook repetido não duplica. Pedido já pago não abre cobrança nova. Outro pagamento externo aprovado no mesmo pedido vai para `NEEDS_REVIEW` sem novo acesso.

Reembolso total: pagamento `REFUNDED`, pedido `REFUNDED`, entitlements daquela compra `REVOKED`. Reembolso parcial: `PARTIALLY_REFUNDED` e pedido `NEEDS_REVIEW`, sem revogar aula. Chargeback confirmado: `CHARGED_BACK`, revoga os entitlements da compra e marca o pedido `REFUNDED` para o valor sair do crédito. O pedido não é apagado. Não há botão de reembolso na aplicação.

## E-mail, histórico e admin

Depois de `PAID`, um e-mail “Compra confirmada — Alexandre Feio” lista itens, total e o link de estudo. `confirmationEmailSentAt` é reivindicado antes do envio. Falha de envio devolve o campo para nulo. Não leva cartão nem documento.

`/app/compras` e `/app/compras/[id]` mostram data, itens, subtotal, crédito, total e status. Pix pendente mostra QR e copia e cola quando o provider devolve. `/admin/compras` só lista e abre o pedido. Não edita valor, não aprova e não reembolsa.

## Analytics

`checkout_started` dispara quando o checkout real abre um pedido ainda não pago. `purchase_completed` dispara só com pedido `PAID`, uma vez por `af_purchase_${orderId}` neste navegador. Payload: `currency`, `value`, `transaction_id` (id do pedido), `item_type` e `item_slug` público. Sem e-mail, documento ou id externo de pagamento. Consent Mode continua valendo.

## Production

Não ligar comércio em production nesta sprint. Falta, nesta ordem:

1. Postgres de production.
2. Migrations nesse banco.
3. Better Auth de production.
4. Credenciais Mercado Pago de production.
5. Webhook HTTPS.
6. Segredo de webhook de production.
7. `COMMERCE_ENABLED=true` só depois dos itens anteriores.
8. Smoke test com dinheiro de teste ainda no ambiente certo.
9. Conteúdo pago completo e marcado `AVAILABLE` de propósito.

Um `migrate diff` posterior não deve apagar o `CHECK` `order_item_one_product` nem o índice parcial `task_active_recommendation_key`.
