import type { BlogCategorySlug, BlogContentRole, BlogCtaKey, BlogSearchIntent } from "@/lib/blog/catalog";

export type InitialBlogPostSeed = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  contentMarkdown: string;
  categorySlug: BlogCategorySlug;
  ctaKey: BlogCtaKey;
  seoTitle: string;
  seoDescription: string;
  status: "DRAFT";
};

export type InitialBlogIdeaSeed = {
  id: string;
  title: string;
  angle: string;
  categorySlug: BlogCategorySlug;
  contentRole: BlogContentRole;
  searchIntent: BlogSearchIntent;
  ctaKey: BlogCtaKey;
  status: "PLANNED";
  rationale: string;
  relatedPostSlug: string;
};

export const INITIAL_BLOG_POSTS: InitialBlogPostSeed[] = [
  {
    id: "seed-blog-post-001",
    slug: "trafego-pago-para-pequenos-negocios-guia-para-comecar",
    title: "Tráfego pago para pequenos negócios: guia para começar",
    excerpt: "Um guia prático para entender quando anunciar, o que preparar antes da campanha e quais sinais acompanhar para não transformar orçamento em cliques sem direção.",
    categorySlug: "trafego-pago",
    ctaKey: "TRAFFIC_COURSE",
    seoTitle: "Tráfego pago para pequenos negócios: como começar",
    seoDescription: "Entenda o que preparar antes de anunciar, como escolher o primeiro canal e quais sinais acompanhar para começar com mais controle.",
    status: "DRAFT",
    contentMarkdown: `## O que tráfego pago resolve — e o que ele não resolve

Tráfego pago é uma forma de colocar uma oferta diante de pessoas que podem ter interesse nela. Na prática, você paga para aumentar a distribuição de uma mensagem em canais como Google Ads ou Meta Ads.

O anúncio, porém, não trabalha sozinho. Ele pode levar a pessoa certa até sua empresa, mas ainda existem outras etapas: a oferta precisa ser compreensível, a página ou o WhatsApp precisa ajudar a pessoa a avançar e a mensuração precisa mostrar o que aconteceu depois do clique.

Por isso, a pergunta inicial não deveria ser apenas **“quanto preciso investir?”**. Uma pergunta melhor é: **“o meu negócio está preparado para transformar atenção em uma próxima ação?”**

## Antes da primeira campanha, responda quatro perguntas

### 1. Qual resultado você quer gerar?

Escolha um objetivo de negócio que possa ser observado. Exemplos: pedidos de orçamento, conversas qualificadas no WhatsApp, vendas ou cadastros.

“Quero divulgar minha empresa” é amplo demais para orientar uma campanha. Quanto mais claro for o resultado esperado, mais fácil fica decidir canal, mensagem, página e métrica.

### 2. O que exatamente está sendo oferecido?

A pessoa precisa entender rapidamente o que você vende, para quem aquilo serve e qual é o próximo passo.

Se a oferta exige uma longa explicação antes de fazer sentido, o problema pode estar antes da campanha. Vale organizar a proposta primeiro e só depois aumentar o tráfego.

### 3. Para onde o anúncio vai levar a pessoa?

O destino pode ser uma landing page, um site, WhatsApp ou outro canal. O importante é que o caminho tenha continuidade.

Se o anúncio promete uma solução específica e a pessoa chega a uma página genérica, ela precisa descobrir sozinha onde clicar e o que fazer. Essa ruptura costuma desperdiçar parte da atenção comprada.

### 4. Como você saberá se funcionou?

Defina antecipadamente quais ações precisam ser medidas. Cliques e visualizações ajudam a entender a entrega, mas não substituem resultados como leads, checkouts ou vendas.

Sem mensuração, qualquer mudança vira opinião. Com mensuração, você consegue comparar o que aconteceu e decidir o próximo teste.

## Google Ads ou Meta Ads?

Não existe um canal universalmente melhor. O ponto de partida depende de como o cliente normalmente encontra a solução.

O Google tende a ser especialmente relevante quando existe procura ativa: a pessoa já pesquisa por um serviço, problema ou produto. Meta pode ser útil quando a descoberta acontece antes da busca, quando a solução precisa ser apresentada ou quando o criativo visual tem papel importante.

Em muitos negócios os dois canais podem participar da jornada, mas isso não significa que você deva começar dividindo um orçamento pequeno em várias campanhas.

## Comece pequeno, mas comece com uma hipótese

Um orçamento menor não impede o aprendizado, mas exige foco. Em vez de abrir várias frentes ao mesmo tempo, escolha uma hipótese clara.

Exemplo: “Pessoas que pesquisam por este serviço na minha região têm intenção suficiente para pedir orçamento nesta landing page.”

A campanha existe para testar essa hipótese com dados. Se houver cliques e ninguém avançar, o próximo diagnóstico não é simplesmente “aumentar o orçamento”. Pode haver problema de intenção, oferta, página, confiança ou atendimento.

## O que acompanhar no início

Evite olhar uma única métrica isoladamente. Observe a sequência:

- o anúncio está aparecendo para buscas ou públicos coerentes?
- as pessoas demonstram interesse suficiente para clicar?
- depois do clique, elas executam a ação esperada?
- o custo dessa ação faz sentido para o negócio?

Essa leitura evita dois extremos: desligar uma campanha cedo demais ou continuar investindo apenas porque ela gera tráfego.

## Um bom primeiro objetivo é aprender com controle

A primeira campanha não precisa provar que você domina anúncios. Ela precisa gerar informação confiável para a próxima decisão.

O processo é contínuo: **atrair, converter, medir e melhorar**. Quando anúncio, destino e mensuração trabalham juntos, o tráfego deixa de ser apenas uma compra de cliques e passa a fazer parte de um sistema de aquisição.`,
  },
  {
    id: "seed-blog-post-002",
    slug: "como-saber-se-seu-negocio-esta-pronto-para-trafego-pago",
    title: "Como saber se seu negócio está pronto para tráfego pago",
    excerpt: "Antes de investir em anúncios, avalie objetivo, oferta, público, destino, mensuração e capacidade de atendimento para descobrir se o gargalo está realmente no tráfego.",
    categorySlug: "trafego-pago",
    ctaKey: "TRAFFIC_COURSE",
    seoTitle: "Seu negócio está pronto para tráfego pago?",
    seoDescription: "Use seis critérios práticos para descobrir se já é hora de anunciar ou se existe um gargalo que precisa ser resolvido antes.",
    status: "DRAFT",
    contentMarkdown: `## Anunciar mais cedo nem sempre significa crescer mais cedo

Quando as vendas estão abaixo do esperado, é comum concluir que o negócio precisa de mais divulgação. Às vezes isso é verdade. Em outros casos, aumentar o tráfego apenas leva mais pessoas para uma jornada que ainda não está preparada para convertê-las.

Antes de investir, vale fazer um diagnóstico simples. A ideia não é buscar perfeição, mas identificar se existe uma base mínima para aprender com a campanha.

## 1. Existe um objetivo claro?

Uma campanha precisa saber qual comportamento representa avanço. Pode ser uma venda, um pedido de orçamento, uma conversa qualificada ou um cadastro.

Se todas as ações parecem igualmente importantes, a mensuração tende a ficar confusa. Defina um objetivo principal e trate os demais como sinais auxiliares.

## 2. A oferta é fácil de entender?

Peça para alguém que não conhece sua empresa responder rapidamente:

- o que está sendo oferecido?
- para quem serve?
- por que vale considerar essa solução?
- o que precisa ser feito agora?

Se essas respostas não aparecem com clareza, o anúncio terá que compensar uma oferta mal apresentada.

## 3. Você sabe quem pretende atrair?

Não é necessário criar uma persona cheia de detalhes fictícios. O importante é conhecer o problema, o contexto e o momento de decisão do cliente.

Uma clínica, por exemplo, pode anunciar para pessoas que já procuram determinado exame. Um produto novo pode depender mais de descoberta. Essas diferenças influenciam canal, mensagem e segmentação.

## 4. O destino continua a promessa do anúncio?

Uma boa campanha pode falhar em uma página ruim.

O destino precisa manter a mesma lógica do anúncio: mesma oferta, contexto suficiente, confiança e uma ação principal evidente. Se a pessoa precisa navegar por vários menus para encontrar o que acabou de ver no anúncio, existe atrito desnecessário.

WhatsApp também precisa ser tratado como destino. Mensagem inicial, tempo de resposta e capacidade de atendimento afetam o resultado.

## 5. Você consegue medir a ação importante?

Antes de anunciar, teste a mensuração.

Não basta instalar uma ferramenta e assumir que tudo está funcionando. Faça a jornada como cliente, envie o formulário, clique no botão, avance no checkout e verifique se os eventos realmente chegam às plataformas corretas.

Sem isso, você corre o risco de otimizar uma campanha com base em sinais incompletos ou duplicados.

## 6. Sua operação consegue atender o que a campanha gerar?

Tráfego não corrige demora no atendimento, falta de estoque ou ausência de processo comercial.

Se dez novos contatos chegassem amanhã, sua empresa saberia o que fazer com eles? Quem responderia? Em quanto tempo? Como saberia quais vieram da campanha?

A capacidade operacional faz parte da prontidão.

## O que fazer quando um critério ainda está fraco

Não significa que você deva adiar anúncios indefinidamente. Significa que o próximo passo deve atacar o principal gargalo.

Se falta clareza de oferta, trabalhe a mensagem. Se o destino está confuso, melhore a página. Se não existe mensuração, configure e teste. Se tudo isso está razoavelmente preparado e falta fluxo de pessoas qualificadas, tráfego pago passa a ser uma hipótese muito mais consistente.

## Prontidão não é perfeição

Você não precisa ter o funil ideal para começar. Precisa ter uma jornada suficientemente clara para que os dados da campanha possam ensinar alguma coisa.

O objetivo do diagnóstico é evitar investir para descobrir tarde demais que o problema estava em outra etapa.`,
  },
  {
    id: "seed-blog-post-003",
    slug: "site-ou-landing-page-qual-usar-para-vender",
    title: "Site ou landing page: qual usar para vender mais?",
    excerpt: "Entenda a diferença prática entre site institucional e landing page e escolha o destino de acordo com a intenção da campanha, a complexidade da oferta e a decisão que o cliente precisa tomar.",
    categorySlug: "sites-landing-pages",
    ctaKey: "SITES_COURSE",
    seoTitle: "Site ou landing page: qual usar para vender?",
    seoDescription: "Compare site e landing page pela jornada do cliente e descubra qual formato faz mais sentido para sua oferta e campanha.",
    status: "DRAFT",
    contentMarkdown: `## A escolha não depende de qual formato é “melhor”

Site e landing page resolvem problemas diferentes. O erro é escolher pelo formato antes de entender o que o visitante precisa fazer.

Um site institucional costuma organizar várias informações sobre a empresa. Uma landing page concentra a atenção em uma oferta ou objetivo específico.

A decisão deve começar pela jornada.

## Quando um site institucional faz sentido

Um site é útil quando o visitante precisa explorar diferentes áreas antes de decidir. Ele pode reunir serviços, informações sobre a empresa, portfólio, conteúdos, contatos e outras provas de confiança.

Isso é especialmente importante quando existem várias soluções ou quando a marca precisa ser pesquisada antes da contratação.

O site funciona como uma base digital mais ampla. O problema aparece quando uma campanha específica envia o usuário para uma página inicial genérica e espera que ele encontre sozinho a oferta anunciada.

## Quando uma landing page faz sentido

Landing page é uma página orientada a uma ação principal.

Ela funciona bem quando anúncio, oferta e destino podem formar uma sequência direta:

**mensagem do anúncio → explicação da oferta → prova → ação.**

Isso reduz escolhas concorrentes e permite controlar melhor a narrativa.

Uma landing page não precisa ser curta. Ela precisa ser focada. Algumas ofertas exigem apenas uma explicação simples; outras precisam de comparação, objeções, processo e perguntas frequentes.

## O problema da página genérica em campanhas

Imagine um anúncio sobre gestão de tráfego para pequenos negócios. A pessoa clica e chega em uma home que também fala de desenvolvimento, cursos, consultoria e vários outros assuntos.

Nada está necessariamente errado com a home. O problema é a continuidade.

A pessoa acabou de demonstrar uma intenção específica. Quanto mais esforço ela precisar fazer para reencontrar essa intenção, maior o risco de abandono.

Por isso, campanhas importantes costumam se beneficiar de destinos específicos.

## Quatro perguntas para escolher

### A oferta é única ou existem várias possibilidades?

Uma oferta bem definida favorece uma landing page. Um portfólio amplo pode exigir um site.

### A pessoa chega por uma campanha específica?

Quanto mais específica for a promessa do anúncio, maior a necessidade de continuidade no destino.

### Quanto contexto é necessário antes da ação?

Serviços de maior consideração podem exigir mais informação, prova e comparação. Isso não impede uma landing page; apenas exige uma estrutura mais completa.

### Qual ação deve acontecer?

Se o objetivo é pedir orçamento, iniciar checkout ou agendar, a página deve deixar essa ação visualmente evidente.

## Você pode usar os dois

Site e landing page não são concorrentes obrigatórios.

Uma empresa pode ter um site institucional para presença, pesquisa de marca e conteúdo e criar landing pages específicas para campanhas, serviços ou ofertas.

Nesse cenário, o site sustenta a marca e as landing pages sustentam jornadas mais focadas.

## A melhor página é a que reduz a distância até a decisão

Antes de escolher a tecnologia ou o layout, escreva o caminho desejado:

1. de onde essa pessoa veio;
2. o que ela espera encontrar;
3. o que precisa entender;
4. o que precisa confiar;
5. qual ação deve executar.

Quando essas respostas estão claras, fica muito mais fácil decidir se você precisa de um site, uma landing page ou dos dois.`,
  },
  {
    id: "seed-blog-post-004",
    slug: "landing-page-que-converte-o-que-precisa-ter",
    title: "Landing page que converte: o que ela precisa ter?",
    excerpt: "Uma landing page eficiente organiza a decisão do visitante. Veja os elementos essenciais para apresentar a oferta, gerar confiança, responder objeções e tornar o próximo passo evidente.",
    categorySlug: "sites-landing-pages",
    ctaKey: "SITES_COURSE",
    seoTitle: "Landing page que converte: elementos essenciais",
    seoDescription: "Veja como estruturar oferta, benefícios, confiança, objeções e CTA em uma landing page pensada para conversão.",
    status: "DRAFT",
    contentMarkdown: `## Conversão começa antes do botão

Uma landing page não converte porque tem um botão colorido. Ela converte melhor quando ajuda a pessoa a entender a oferta, avaliar se aquilo serve para ela, reduzir dúvidas e encontrar uma próxima ação sem esforço.

Por isso, estrutura importa mais do que quantidade de seções.

## 1. Uma primeira dobra que explica a proposta

Nos primeiros segundos, o visitante deveria conseguir entender três coisas:

- o que você oferece;
- para quem ou para qual problema;
- qual é o próximo passo.

Evite títulos genéricos como “soluções que transformam seu negócio”. Eles podem soar profissionais, mas exigem interpretação.

Uma promessa específica normalmente orienta melhor a leitura.

## 2. Benefícios ligados ao problema real

Recursos descrevem o que a solução possui. Benefícios explicam por que aquilo importa.

Em vez de apenas listar “relatórios”, por exemplo, explique que a pessoa conseguirá acompanhar o que aconteceu com o investimento e tomar decisões com base em dados.

O benefício deve conectar a característica a uma consequência relevante.

## 3. Uma sequência visual que indique prioridade

Hierarquia não é decoração. Tamanho, contraste, espaçamento e posição ajudam o visitante a perceber o que é principal e o que é complementar.

Se título, textos, links e botões competem com o mesmo peso, a página obriga a pessoa a organizar a informação sozinha.

Um bom layout deixa clara a ordem de leitura.

## 4. Provas de confiança verdadeiras

Dependendo do negócio, confiança pode vir de diferentes fontes:

- experiência profissional;
- processo explicado;
- casos reais;
- depoimentos legítimos;
- certificações;
- informações de contato;
- política de privacidade;
- clareza sobre o que será entregue.

Não use prova social inventada. É melhor ter menos provas verdadeiras do que preencher a página com números ou depoimentos sem base.

## 5. Objeções respondidas antes do contato

Perguntas frequentes não devem existir só para ocupar o fim da página.

Liste as dúvidas que realmente impedem alguém de avançar: prazo, funcionamento, escopo, atendimento, pagamento, requisitos ou o que acontece depois do clique.

Responder uma objeção no momento certo pode reduzir atrito comercial.

## 6. Um CTA principal evidente

O visitante precisa reconhecer visualmente a ação principal.

Se comprar, solicitar orçamento ou iniciar uma aula é importante, essa ação não deveria parecer um link secundário perdido no texto.

Botão, texto e contexto devem trabalhar juntos. O rótulo precisa dizer o que acontecerá, como “Solicitar orçamento”, “Começar aula gratuita” ou “Ver o curso”.

Isso não significa transformar todos os links em botões. A hierarquia exige que ações principais pareçam principais e navegação complementar continue complementar.

## 7. Responsividade e experiência móvel

Muitas páginas parecem organizadas no desktop e ficam cansativas no celular.

Teste largura de texto, espaçamento, tamanho de toque, formulários, menus, imagens e principalmente a visibilidade do CTA. A pessoa não deveria precisar ampliar a tela ou disputar espaço com elementos fixos.

## 8. Mensuração desde o início

Uma landing page publicada sem mensuração limita sua capacidade de aprender.

Defina quais ações representam avanço e teste se os eventos funcionam. Depois, observe onde a jornada perde força: anúncio, página, formulário, checkout ou atendimento.

## A estrutura deve servir à decisão

Não existe um número obrigatório de seções. Existe uma pergunta central: **o que esta pessoa precisa compreender e confiar para executar a próxima ação?**

Use essa resposta para decidir o que entra, o que sai e qual elemento merece mais destaque.`,
  },
  {
    id: "seed-blog-post-005",
    slug: "por-que-anuncios-recebem-cliques-mas-nao-geram-clientes",
    title: "Por que seus anúncios recebem cliques, mas não geram clientes?",
    excerpt: "Cliques sem clientes não significam automaticamente que o anúncio falhou. Aprenda a localizar o gargalo entre intenção, promessa, página, oferta, mensuração e atendimento.",
    categorySlug: "aquisicao-conversao",
    ctaKey: "COURSES_HUB",
    seoTitle: "Anúncios têm cliques, mas não geram clientes: por quê?",
    seoDescription: "Descubra como diagnosticar cliques sem conversão analisando intenção, anúncio, página, oferta, mensuração e atendimento.",
    status: "DRAFT",
    contentMarkdown: `## Clique é uma etapa, não o resultado final

Quando uma campanha começa a receber cliques e as vendas não aparecem, a reação mais comum é mexer no anúncio. Às vezes o anúncio é o problema. Mas o clique apenas mostra que alguma combinação de mensagem, público e contexto despertou interesse suficiente para uma pessoa visitar o destino.

Depois disso, outras etapas passam a influenciar o resultado.

## 1. O clique veio da intenção certa?

Nem todo tráfego possui a mesma qualidade.

No Google Ads, termos muito amplos podem trazer pessoas pesquisando algo relacionado, mas com uma intenção diferente da oferta. Em campanhas sociais, um criativo pode despertar curiosidade sem gerar intenção comercial suficiente.

Antes de culpar a página, observe de onde vieram os acessos e o que essas pessoas provavelmente estavam tentando resolver.

## 2. A promessa continua depois do clique?

O anúncio cria uma expectativa. A página precisa continuar a mesma conversa.

Se o anúncio fala de um serviço específico e o destino abre uma home genérica, o visitante precisa procurar a oferta novamente. Se o anúncio destaca uma condição que quase não aparece na página, surge uma quebra de confiança.

Consistência entre anúncio e destino reduz esse atrito.

## 3. A oferta está clara o suficiente?

Uma página bonita não compensa uma oferta difícil de compreender.

Verifique se o visitante consegue entender:

- o problema resolvido;
- o que será entregue;
- para quem serve;
- como funciona;
- qual é a próxima ação.

Se ele precisa entrar em contato apenas para descobrir o básico, parte dos potenciais clientes pode desistir antes.

## 4. O CTA parece realmente uma ação?

Ações importantes precisam ter hierarquia visual.

Um link discreto no meio de outros elementos pode ser tecnicamente clicável e ainda assim ter baixa percepção. Comprar, solicitar orçamento ou iniciar uma etapa deve ser reconhecível sem caça ao botão.

Avalie texto, contraste, posição e repetição coerente do CTA ao longo da jornada.

## 5. Existe confiança para avançar?

Quanto maior o risco percebido, maior a necessidade de confiança.

Informações sobre processo, responsável, condições, contato, privacidade, cases verdadeiros e perguntas frequentes podem reduzir incerteza. A prova necessária depende da oferta.

## 6. A conversão está sendo medida corretamente?

Também existe o caso oposto: clientes estão avançando, mas a telemetria não registra.

Teste a jornada completa. Não assuma que um evento existe apenas porque foi configurado. Verifique formulários, WhatsApp, checkout e compra nas ferramentas de depuração.

Uma medição duplicada também é perigosa: pode ensinar a plataforma que houve mais resultados do que realmente ocorreram.

## 7. O atendimento está deixando o lead esfriar?

Se a conversão termina no WhatsApp ou em um formulário, a experiência continua depois do site.

Tempo de resposta, abordagem, disponibilidade e processo comercial podem transformar uma campanha aparentemente ruim em um problema operacional.

## Diagnostique na ordem da jornada

Em vez de trocar tudo ao mesmo tempo, siga o caminho do usuário:

**origem → anúncio → clique → destino → ação → atendimento → resultado.**

Encontre o primeiro ponto em que o comportamento esperado deixa de acontecer. Essa é uma hipótese melhor para o próximo teste.

## Melhorar aquisição exige olhar além da campanha

Tráfego e conversão são partes do mesmo sistema. Se você otimiza apenas o anúncio, pode continuar comprando atenção para uma experiência que não ajuda o visitante a decidir.

O objetivo é descobrir onde está a perda e melhorar uma variável por vez.`,
  },
  {
    id: "seed-blog-post-006",
    slug: "trafego-ou-conversao-como-identificar-o-gargalo",
    title: "Tráfego ou conversão: como identificar onde está o gargalo",
    excerpt: "Use a jornada do usuário para diferenciar falta de tráfego de problemas de oferta, página, mensuração ou atendimento e decidir o que melhorar primeiro.",
    categorySlug: "aquisicao-conversao",
    ctaKey: "COURSES_HUB",
    seoTitle: "Tráfego ou conversão: como identificar o gargalo",
    seoDescription: "Aprenda a separar problemas de aquisição e conversão e encontre o ponto da jornada que merece ser melhorado primeiro.",
    status: "DRAFT",
    contentMarkdown: `## Mais tráfego não corrige todo problema de vendas

Imagine duas empresas com poucas vendas. A primeira recebe poucas visitas qualificadas, mas converte bem quando alguém chega. A segunda recebe bastante tráfego, porém quase ninguém avança.

As duas têm o mesmo sintoma final, mas precisam de decisões diferentes.

O objetivo do diagnóstico é localizar o primeiro gargalo relevante da jornada.

## Comece desenhando o caminho real

Escreva as etapas que uma pessoa percorre até gerar valor para o negócio.

Um exemplo simples:

**pesquisa ou anúncio → página → clique no CTA → formulário ou WhatsApp → atendimento → venda.**

Em um curso digital, o caminho pode ser:

**anúncio → página do curso → aula gratuita → diagnóstico → checkout → compra.**

Sem esse mapa, métricas ficam soltas.

## Sinal 1: quase ninguém qualificado chega

Se impressões, alcance ou visitas relevantes são baixos, pode existir um gargalo de aquisição.

Isso não significa automaticamente aumentar orçamento. Primeiro verifique se existe procura suficiente, se a segmentação está coerente e se a campanha consegue participar dos leilões importantes.

Quando o destino converte razoavelmente e ainda assim faltam oportunidades, ampliar aquisição passa a fazer mais sentido.

## Sinal 2: existe tráfego, mas pouca ação na página

Se pessoas qualificadas chegam e quase ninguém clica no CTA, envia formulário ou inicia checkout, investigue a experiência de conversão.

Possíveis causas:

- promessa do anúncio não continua na página;
- oferta pouco clara;
- CTA sem destaque;
- falta de confiança;
- página lenta ou ruim no celular;
- ação exige esforço excessivo.

Nesse cenário, comprar ainda mais visitas pode apenas ampliar desperdício.

## Sinal 3: há ações, mas elas não viram resultado

Se existem contatos ou checkouts e poucas vendas, o gargalo pode estar depois da página.

Analise qualidade dos leads, atendimento, preço, condições, método de pagamento, erros no checkout e acompanhamento comercial.

A métrica do anúncio não consegue explicar sozinha o que acontece nessa fase.

## Sinal 4: os números não fecham entre as ferramentas

Antes de otimizar, confirme que você está olhando dados confiáveis.

Se Analytics, plataforma de anúncios e banco registram volumes muito diferentes, investigue consentimento, duplicidade, eventos disparados no momento errado e diferenças de atribuição.

Para eventos comerciais, mantenha uma fonte operacional de verdade. Analytics ajuda a entender a jornada; ele não deve substituir o registro real de pedido ou pagamento.

## Use taxas entre etapas, não apenas totais

Totais mostram volume. Taxas ajudam a localizar perda.

Exemplos:

- visitantes que iniciam uma ação;
- pessoas que começam e concluem um diagnóstico;
- checkouts que viram compras;
- leads que viram clientes.

Não existe uma taxa universal que sirva para todos os negócios. O valor está em comparar períodos, origens e mudanças dentro do seu próprio contexto.

## Mude uma hipótese por vez

Se você troca anúncio, oferta, página e orçamento ao mesmo tempo, pode até melhorar o resultado e ainda não saber por quê.

Escolha o gargalo mais provável, altere uma variável relevante e observe a consequência.

Esse ciclo transforma marketing em processo:

**atrair → converter → medir → melhorar.**

A pergunta deixa de ser “o que está errado?” e passa a ser “em qual etapa temos evidência suficiente para agir agora?”.`,
  },
];

export const INITIAL_BLOG_IDEAS: InitialBlogIdeaSeed[] = [
  {
    id: "seed-blog-idea-001",
    title: "Google Ads ou Meta Ads: qual faz mais sentido para o seu negócio?",
    angle: "Comparar os canais pela intenção do cliente e pelo estágio de descoberta, sem declarar um vencedor universal.",
    categorySlug: "trafego-pago",
    contentRole: "SATELLITE",
    searchIntent: "COMMERCIAL_INVESTIGATION",
    ctaKey: "TRAFFIC_COURSE",
    status: "PLANNED",
    rationale: "É o próximo passo lógico depois do guia de introdução: o leitor já entendeu a base e precisa decidir por onde começar sem dividir orçamento por impulso.",
    relatedPostSlug: "trafego-pago-para-pequenos-negocios-guia-para-comecar",
  },
  {
    id: "seed-blog-idea-002",
    title: "Quanto investir em tráfego pago no início?",
    angle: "Ensinar orçamento como hipótese de aprendizagem e capacidade econômica, evitando promessas de valor mínimo universal.",
    categorySlug: "trafego-pago",
    contentRole: "SATELLITE",
    searchIntent: "INFORMATIONAL",
    ctaKey: "TRAFFIC_COURSE",
    status: "PLANNED",
    rationale: "Depois de verificar prontidão e canal, o usuário naturalmente precisa transformar a decisão em um orçamento inicial controlável.",
    relatedPostSlug: "como-saber-se-seu-negocio-esta-pronto-para-trafego-pago",
  },
  {
    id: "seed-blog-idea-003",
    title: "Como saber se sua página está pronta para receber tráfego pago",
    angle: "Checklist de continuidade entre anúncio, oferta, confiança, CTA, mobile e mensuração antes de aumentar visitas.",
    categorySlug: "sites-landing-pages",
    contentRole: "SATELLITE",
    searchIntent: "INFORMATIONAL",
    ctaKey: "SITES_COURSE",
    status: "PLANNED",
    rationale: "Conecta o pilar de sites ao de aquisição e prepara o leitor para avaliar uma página existente antes de reconstruí-la.",
    relatedPostSlug: "landing-page-que-converte-o-que-precisa-ter",
  },
  {
    id: "seed-blog-idea-004",
    title: "Primeira dobra de landing page: o que precisa aparecer",
    angle: "Mostrar como proposta, contexto e CTA devem funcionar na primeira tela sem transformar a dobra em uma fórmula rígida.",
    categorySlug: "sites-landing-pages",
    contentRole: "SATELLITE",
    searchIntent: "INFORMATIONAL",
    ctaKey: "SITES_COURSE",
    status: "PLANNED",
    rationale: "Aprofunda um componente concreto depois que o leitor já compreendeu quando usar landing page e quais elementos a página precisa ter.",
    relatedPostSlug: "landing-page-que-converte-o-que-precisa-ter",
  },
  {
    id: "seed-blog-idea-005",
    title: "Como medir a jornada do clique até a conversão",
    angle: "Explicar eventos intermediários, macroconversões, fonte operacional de verdade e por que nem toda interação deve ser tratada como conversão principal.",
    categorySlug: "aquisicao-conversao",
    contentRole: "SATELLITE",
    searchIntent: "INFORMATIONAL",
    ctaKey: "COURSES_HUB",
    status: "PLANNED",
    rationale: "Depois de identificar possíveis gargalos, o próximo passo é construir mensuração suficiente para confirmar em qual etapa a jornada perde força.",
    relatedPostSlug: "trafego-ou-conversao-como-identificar-o-gargalo",
  },
  {
    id: "seed-blog-idea-006",
    title: "O que melhorar primeiro: tráfego, oferta ou página?",
    angle: "Criar uma árvore de decisão simples para priorizar o primeiro gargalo observável sem mudar várias variáveis ao mesmo tempo.",
    categorySlug: "aquisicao-conversao",
    contentRole: "PILLAR",
    searchIntent: "COMMERCIAL_INVESTIGATION",
    ctaKey: "COURSES_HUB",
    status: "PLANNED",
    rationale: "Consolida a tese Atrair → Converter → Medir → Melhorar e pode se tornar o conteúdo central que conecta os dois cursos.",
    relatedPostSlug: "trafego-ou-conversao-como-identificar-o-gargalo",
  },
];
