# Produção de conteúdo

## Aula 1

- Título: Como funciona o tráfego pago e quando ele faz sentido
- Slug: `como-funciona-o-trafego-pago`
- Status: conteúdo definitivo V1
- Versão: 1
- Origem: editorial aprovada
- Seed: `seedLesson01Content`, chamado por `npm run db:seed`
- Data: 2026-10-12
- Acesso: gratuita e fora de venda
- Blocos ativos: 27, nenhum de imagem

O resultado usa os cinco campos curtos do bloco `RESULT` já existente. A atividade continua um texto único. Não há cópia automática de uma para o outro. A frase para quando não existe bloqueio fica no enunciado do resultado. Cada valor salvo nesse bloco aceita até 200 caracteres. O banco não impõe tamanho: o limite está no schema, no campo e na ação do servidor, que recusa o excesso em vez de cortar o texto.

O checklist não tem título no schema; os seis itens estão no bloco. A conclusão também não tem título; “Você já deu o primeiro passo” abre o corpo.

## Aula 2

- Título: Google Ads ou Meta Ads: qual escolher?
- Slug: `google-ads-ou-meta-ads`
- Status: conteúdo definitivo V1
- Versão: 1
- Origem: editorial aprovada
- Seed: `seedLesson02Content`, chamado por `npm run db:seed`
- Data: 2026-10-13
- Acesso: gratuita e fora de venda
- Blocos ativos: 28, nenhum de imagem

O resultado reutiliza os cinco campos curtos de até 200 caracteres. O aluno registra a indicação de canal; nada é calculado a partir da atividade. O checklist reflexivo não conta progresso nem bloqueia a conclusão. “Observe o seu negócio” não cabe no schema do checklist. “Você já consegue escolher com mais critério” abre a conclusão, e “Como seu cliente chega até você?” abre o enunciado da atividade.

## Aula 3

- Título: Seu negócio está pronto para anunciar?
- Slug: `negocio-pronto-para-anunciar`
- Status: conteúdo definitivo V1
- Versão: 1
- Origem: editorial aprovada
- Seed: `seedLesson03Content`, chamado por `npm run db:seed`
- Data: 2026-10-13
- Acesso: gratuita e fora de venda
- Blocos ativos: 27, nenhum de imagem e nenhum `RESULT` manual
- Resultado: diagnóstico `traffic-readiness-v1`, vinculado à aula por `LessonResponse` (`projectId` e `diagnosticId`)

O bloco `TOOL` aponta para a ferramenta. Ele não repete as 15 perguntas nem copia nota, gargalo ou recomendação para `LessonResult`. O diagnóstico continua sendo a fonte desses dados.

## Aula 4

- Título: Defina objetivo, oferta e orçamento
- Slug: `objetivo-oferta-orcamento`
- Status: conteúdo definitivo V1
- Versão: 1
- Origem: editorial aprovada
- Seed: `seedLesson04Content`, chamado por `npm run db:seed`
- Data: 2026-10-13
- Acesso: paga, R$ 29,90, fora de venda
- Blocos ativos: 30, nenhum de imagem e nenhum `RESULT` manual
- Resultado: `CAMPAIGN_BRIEF_V1` em `LessonResult`, um por projeto

O brief guarda oferta, objetivo, conversão, destino, orçamento mensal em centavos, referência diária, prazo da primeira revisão e o que falta validar. A referência diária é `floor((centavos mensais + 15) / 30)`, o arredondamento half-up de dividir por 30. R$ 600,00 viram R$ 20,00. É planejamento, não o gasto diário da plataforma. O projeto só é atualizado se o aluno confirmar. A aula continua `NOT_FOR_SALE`.
