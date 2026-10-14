# Lançamento de cadastro e comércio

Status deste gate: o código de production está preparado e fechado. Nenhum produto foi marcado `AVAILABLE`. Nenhuma cobrança real foi feita. A Aula 7 não foi produzida.

## Banco

O ambiente local tem um único Postgres de development (`DATABASE_ENV=development`). Runtime usa o host pooled e a migration usa o host direto do mesmo projeto. Não há segunda URL de production no `.env.local` e o projeto não está ligado a um ambiente Vercel com banco próprio.

Por isso este gate não executou `migrate deploy`, `catalog:deploy` nem smoke em production. O banco de development não pode ser reutilizado como production.

Quando o banco separado existir:

1. Conferir backup no provider.
2. Colocar `RUNTIME_DATABASE_URL` e `POSTGRES_URL` só nas variáveis de production da Vercel.
3. `DATABASE_ENV=production` somente nesse ambiente.
4. Rodar `npm run db:deploy` a partir de uma máquina que aponte para esse banco, nunca com `VERCEL_ENV=production` no processo e nunca com `db push`.
5. Conferir as tabelas de auth, educação, projeto, diagnóstico, tarefas, comércio e editorial.

## Auth e e-mail

Better Auth já usa `BETTER_AUTH_URL` e, na ausência dela em `VERCEL_ENV=production`, `https://alexandrefeio.com.br`. O secret não vai ao browser. Confirmação de conta, reset de senha e confirmação de compra saem pelo Resend, com o remetente `contato@alexandrefeio.com.br`.

Falha de e-mail não desfaz pagamento. O smoke real de cadastro, confirmação, login, logout, reset, sessão, `/app` e `/admin` fica para depois que o banco de production existir. Não usar `@example.com` nesse teste. Remover a conta controlada ao final.

Aulas 1 e 2 continuam anônimas. O progresso local entra na conta pelo merge já existente: resposta e resultado do servidor prevalecem, e a retomada fica no bloco mais adiante. O convite “Salve seu progresso na sua conta” aparece só depois do resultado principal, com retorno para a aula e o bloco. Não impede concluir a aula. A Aula 3 continua com o gate apenas na ferramenta.

## Mercado Pago

Credencial de teste e credencial de production ficam em ambientes diferentes. O código não copia uma para a outra e não olha o prefixo da chave.

O comércio abre só nestas combinações:

| Modo | Condições |
| --- | --- |
| Teste | `COMMERCE_ENABLED=true`, `MERCADO_PAGO_ENV=test`, `DATABASE_ENV=development`, fora de `VERCEL_ENV=production`, `COMMERCE_PRODUCTION_READY` diferente de `true`, public key, access token e webhook secret presentes |
| Production | `COMMERCE_ENABLED=true`, `COMMERCE_PRODUCTION_READY=true`, `MERCADO_PAGO_ENV=production`, `DATABASE_ENV=production`, `VERCEL_ENV=production`, as três credenciais de production presentes |

Qualquer outra combinação deixa o comércio fechado.

A API continua `POST /v1/orders` e `GET /v1/orders/{id}`. No teste, o pagador enviado ao provider continua o e-mail exigido pela documentação de teste. Em production, o e-mail é o da conta.

Webhook: `https://alexandrefeio.com.br/api/webhooks/mercado-pago`. A assinatura é verificada. O webhook sozinho não libera acesso: a reconciliação lê o pedido no provider. `live_mode: true` é ignorado no modo teste. `live_mode` diferente de `true` é ignorado no modo production.

## Catálogo e ativação comercial

`catalog:deploy` e a ativação de venda são comandos diferentes.

`npm run db:seed` continua recusando production e regrava `commerceStatus` como `NOT_FOR_SALE`. Esse fechamento é só do seed de development.

`npm run catalog:deploy` faz upsert de curso, módulos, aulas, blocos aprovados, preços e previews. Registro novo nasce `NOT_FOR_SALE`. Registro que já existe mantém o `commerceStatus` atual, seja `NOT_FOR_SALE` ou `AVAILABLE`. Não apaga progresso, resposta, nota, marcador, `LessonResult`, projeto, diagnóstico, pedido, pagamento nem entitlement. Se o conteúdo em uso divergir, o seed da aula para. Não foi executado em production.

`npm run commerce:products` lista o estado comercial. Sem `--apply`, é dry-run e não grava. Com `--apply`, pode marcar `AVAILABLE` ou voltar para `NOT_FOR_SALE`. Não altera `COMMERCE_ENABLED` nem `COMMERCE_PRODUCTION_READY`. Em `DATABASE_ENV=production` também exige `COMMERCE_CATALOG_CONFIRM=production`. Não roda com `VERCEL_ENV=production`.

Nesta fase a allowlist é só a Aula 4, a Aula 5, a Aula 6 e o Módulo 1. Aula incompleta, aulas 7–12, módulo Google Ads, módulo Meta Ads, módulo de análise e o curso completo são recusados. O módulo só ativa se as aulas 4 e 5 já estiverem `AVAILABLE` e prontas. Desativar a venda não apaga pedido, pagamento nem entitlement.

A venda no site continua exigindo as duas condições: produto `AVAILABLE` e comércio global habilitado.

## O que poderá ser vendido depois

Somente Aula 4 (R$ 29,90), Aula 5 (R$ 34,90), Módulo 1 (R$ 57,90) e Aula 6 (R$ 39,90). Módulo Google Ads, curso completo e Aulas 7–12 permanecem fora de venda. O paywall só mostra compra quando o comércio está aberto e aquele produto está `AVAILABLE`. O curso completo não aparece enquanto estiver `NOT_FOR_SALE`. O crédito de upgrade continua sendo a diferença já paga.

## SEO e analytics

Aulas 1–3 seguem indexáveis por completo. Aulas 4–6 seguem com a mesma amostra pública. Aulas 7–12 seguem `noindex`. Ligar o comércio não muda o HTML indexável.

Eventos de aquisição e `purchase_completed` permanecem sem dado pessoal. `purchase_completed` só depois de pedido `PAID` confirmado pelo provider, com deduplicação.

## Smoke que ainda não rodou

Home, curso, aulas 1–3, previews 4–6, cadastro, confirmação, login, `/app`, projeto e diagnóstico em production. Cookies, sessão, e-mail e banco de production dependem da infra que ainda não existe.

## Ativação futura

Depois do banco, das migrations, do `catalog:deploy` confirmado, do webhook de production e de um smoke sem cobrança:

1. Ligar `COMMERCE_ENABLED`, `COMMERCE_PRODUCTION_READY`, `MERCADO_PAGO_ENV=production` e as credenciais de production na Vercel.
2. Conferir o dry-run de `npm run commerce:products -- --enable` para a Aula 4, a Aula 5, o Módulo 1 e a Aula 6.
3. Gravar com `--apply` e `COMMERCE_CATALOG_CONFIRM=production`. O módulo só entra depois das aulas 4 e 5.

Rollback da venda: `npm run commerce:products -- --disable <slug> --apply`, com a mesma confirmação em production. Quem já comprou continua com acesso. Desligar `COMMERCE_ENABLED` ou `COMMERCE_PRODUCTION_READY` fecha o checkout na hora. Entitlements já concedidos permanecem. Não apagar o banco.

## Search Console

A estratégia não mudou. Depois do deploy correto, pedir indexação manual de:

- https://alexandrefeio.com.br/
- https://alexandrefeio.com.br/cursos/trafego-pago-na-pratica
- https://alexandrefeio.com.br/aulas/como-funciona-o-trafego-pago
- https://alexandrefeio.com.br/aulas/google-ads-ou-meta-ads
- https://alexandrefeio.com.br/aulas/negocio-pronto-para-anunciar
- https://alexandrefeio.com.br/aulas/objetivo-oferta-orcamento
- https://alexandrefeio.com.br/aulas/destino-e-mensuracao
- https://alexandrefeio.com.br/aulas/campanha-de-pesquisa
- https://alexandrefeio.com.br/trafego-pago
