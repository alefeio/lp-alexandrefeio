# Pagamentos

Status: preparação. Mercado Pago não será integrado nesta fase.

## Gateway previsto

Mercado Pago, primeiro com Pix e cartão. A aplicação não fala com o gateway no browser com segredo. Preferência e webhook ficam no servidor.

## Peças

| Peça | Papel |
| --- | --- |
| `Order` | Intenção de compra do usuário. Uma ordem, um ou mais itens |
| `OrderItem` | Aula, módulo ou curso, com tipo, id do produto e preço cobrado na hora |
| `Payment` | Tentativa financeira. Status `PENDING`, `APPROVED`, `REJECTED`, `CANCELLED`, `REFUNDED` |
| `Entitlement` | Direito de acesso. Nasce quando um pagamento fica `APPROVED`, ou por crédito aplicado, ou por concessão admin |
| Crédito de upgrade | Saldo do que o aluno já pagou por aulas ou módulos que entram num pacote maior. Não é status de pagamento nem entitlement |

Comprar um módulo cria entitlement do módulo; a checagem de acesso inclui as aulas daquele módulo. O mesmo vale para o curso. Comprar uma aula cria entitlement só daquela aula.

## O que precisa ficar decidido antes do código do gateway

1. O item do pedido guarda o preço da época. Mudar o preço do catálogo não reescreve a compra nem o crédito.
2. Webhook identifica o pagamento externo. Processar de novo o mesmo aviso não cria outro entitlement. A chave de idempotência é o id do pagamento no Mercado Pago, guardado de forma única.
3. Entitlement só depois de `APPROVED`. `PENDING` não abre aula.
4. Reembolso muda o pagamento para `REFUNDED`. O que acontece com o acesso (revogar ou manter) fica `PENDING`.
5. Crédito é um lançamento: origem (item já pago) e uso (abatimento em outra ordem). Não embutir o valor “de graça” dentro do entitlement.

Nada disso cria tabela agora. O risco de adiar é misturar, na sprint de monetização, “pagou” com “pode ver a aula”.
