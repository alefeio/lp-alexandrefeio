# Lançamento de cadastro e comércio

Status deste gate: o código de production está preparado e fechado. Nenhum produto foi marcado `AVAILABLE`. Nenhuma cobrança real foi feita. A Aula 7 não foi produzida.

## Banco compartilhado

Development e production usam o mesmo Postgres físico. Isso é intencional. Não criar outro banco e não migrar os dados para outro banco.

`DATABASE_ENV` é o rótulo do runtime da aplicação. Não é a identidade do banco.

- Local: `DATABASE_ENV=development`
- Vercel Production: `DATABASE_ENV=production`

As URLs pooled e direta apontam para o mesmo projeto. `DATABASE_ENV=development` não significa banco descartável. Seed, fixture, migration e ativação comercial feitos na máquina local atingem o schema e os dados que o site em production lê.

Riscos:

- uma migration aplicada em development altera o schema de production na hora;
- `db:seed` e `catalog:deploy` reescrevem conteúdo editorial no banco vivo;
- a suíte cria fixtures com id próprio e apaga só esses ids; não existe varredura por nome ou e-mail;
- uma conta criada no smoke de production permanece nesse banco e não deve ser apagada como se fosse teste.

Antes de uma migration futura:

1. Revisar o SQL.
2. Confirmar compatibilidade com o código que já está no ar.
3. Fazer backup quando a alteração tiver risco.
4. Evitar migration destrutiva com tráfego ativo.
5. Preferir expandir o schema, publicar o código e só depois migrar ou limpar.
6. Nunca usar `db push`.
7. Não rodar `npm run db:deploy` com `VERCEL_ENV=production` no processo.

Este gate só consultou `migrate status`. Não reaplicou migration já registrada.

## Auth e e-mail

Better Auth já usa `BETTER_AUTH_URL` e, na ausência dela em `VERCEL_ENV=production`, `https://alexandrefeio.com.br`. O secret não vai ao browser. Confirmação de conta, reset de senha e confirmação de compra saem pelo Resend, com o remetente `contato@alexandrefeio.com.br`.

Falha de e-mail não desfaz pagamento. O smoke real ainda não rodou. A conta criada em production aparece neste mesmo banco. Isso é esperado. Não apagar essa conta.

Checklist do primeiro smoke de auth, com destinatário real, sem `@example.com`:

1. Cadastro.
2. Confirmação por e-mail.
3. Login.
4. Logout.
5. Reset de senha.
6. `/app`.
7. Project.
8. Diagnostic.

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

Webhook: `https://alexandrefeio.com.br/api/webhooks/mercado-pago`. A assinatura é obrigatória. O webhook sozinho não libera acesso: a reconciliação lê o pedido no provider. O modo teste aceita somente `live_mode=false`. O modo production aceita somente `live_mode=true`. Ausência de `live_mode` não passa. As credenciais de production do Mercado Pago e o webhook já foram configurados fora do repositório. Este gate não imprime esses valores e não liga o comércio.

## Catálogo e ativação comercial

`catalog:deploy` e a ativação de venda são comandos diferentes.

`npm run db:seed` e `npm run catalog:deploy` preservam o `commerceStatus` de produto existente. Registro novo nasce `NOT_FOR_SALE`. Nenhum dos dois apaga progresso, resposta, nota, marcador, `LessonResult`, projeto, diagnóstico, pedido, pagamento nem entitlement. Se a aula já tem uso e o conteúdo versionado removeria ou reescreveria um `blockKey`, o seed para. Acrescentar `blockKey` novo continua permitido. Os dois comandos exigem confirmação porque gravam no banco compartilhado: `CATALOG_DEPLOY_CONFIRM=shared` em development ou test, e `CATALOG_DEPLOY_CONFIRM=production` quando o rótulo é production. Não rodam com `VERCEL_ENV=production`. Este gate não executou nenhum dos dois.

`npm run commerce:products` lista o estado comercial. Sem `--apply`, é dry-run e não grava. Com `--apply`, pode marcar `AVAILABLE` ou voltar para `NOT_FOR_SALE`. Não altera `COMMERCE_ENABLED` nem `COMMERCE_PRODUCTION_READY`. Em development ou test exige `COMMERCE_CATALOG_CONFIRM=shared`. Com `DATABASE_ENV=production` exige `COMMERCE_CATALOG_CONFIRM=production`. Não roda com `VERCEL_ENV=production`.

Nesta fase a allowlist é só a Aula 4, a Aula 5, a Aula 6 e o Módulo 1. Aula incompleta, aulas 7–12, módulo Google Ads, módulo Meta Ads, módulo de análise e o curso completo são recusados. O módulo só ativa se as aulas 4 e 5 já estiverem `AVAILABLE` e prontas. Desativar a venda não apaga pedido, pagamento nem entitlement.

A venda no site exige produto `AVAILABLE`, `COMMERCE_ENABLED` e, em production, `COMMERCE_PRODUCTION_READY`. `AVAILABLE` sozinho não abre checkout.

## O que poderá ser vendido depois

Somente Aula 4 (R$ 29,90), Aula 5 (R$ 34,90), Módulo 1 (R$ 57,90) e Aula 6 (R$ 39,90). Módulo Google Ads, curso completo e Aulas 7–12 permanecem fora de venda. O paywall só mostra compra quando o comércio está aberto e aquele produto está `AVAILABLE`. O curso completo não aparece enquanto estiver `NOT_FOR_SALE`. O crédito de upgrade continua sendo a diferença já paga.

## SEO e analytics

Aulas 1–3 seguem indexáveis por completo. Aulas 4–6 seguem com a mesma amostra pública. Aulas 7–12 seguem `noindex`. Ligar o comércio não muda o HTML indexável.

Eventos de aquisição e `purchase_completed` permanecem sem dado pessoal. `purchase_completed` só depois de pedido `PAID` confirmado pelo provider, com deduplicação.

## Variáveis esperadas na Vercel Production

O código não exige banco exclusivo. Os nomes, sem valores:

- `DATABASE_ENV=production`
- `RUNTIME_DATABASE_URL`
- `POSTGRES_URL`
- `BETTER_AUTH_URL`
- `BETTER_AUTH_SECRET`
- `RESEND_API_KEY`
- `RESEND_FROM`
- `NEXT_PUBLIC_MERCADO_PAGO_PUBLIC_KEY`
- `MERCADO_PAGO_ACCESS_TOKEN`
- `MERCADO_PAGO_WEBHOOK_SECRET`
- `MERCADO_PAGO_ENV=production`
- `COMMERCE_ENABLED=false`
- `COMMERCE_PRODUCTION_READY=false`

`COMMERCE_ENABLED` e `COMMERCE_PRODUCTION_READY` permanecem false até uma aprovação posterior. Produto `AVAILABLE` sozinho não abre checkout.

## Smoke que ainda não rodou

Home, curso, aulas 1–3, previews 4–6, o checklist de auth acima, e a entrega do webhook sem conceder acesso só pelo payload. Este gate não conferiu os valores secretos da Vercel.

## Ativação futura

Depois das variáveis de production conferidas, do webhook observado e de um smoke sem cobrança:

1. Ligar `COMMERCE_ENABLED`, `COMMERCE_PRODUCTION_READY`, `MERCADO_PAGO_ENV=production` e as credenciais de production na Vercel.
2. Conferir o dry-run de `npm run commerce:products -- --enable` para a Aula 4, a Aula 5, o Módulo 1 e a Aula 6.
3. Gravar com `--apply` e a confirmação do banco compartilhado. O módulo só entra depois das aulas 4 e 5.

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
