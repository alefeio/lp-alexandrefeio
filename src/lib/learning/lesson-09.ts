import type { LessonBlockData } from "@/lib/learning/blocks";

export const LESSON_09_SLUG = "objetivo-publico-estrutura";
export const LESSON_10_SLUG = "campanhas-leads-whatsapp";

export const lesson09Meta = {
  title: "Escolha objetivo, público e estrutura",
  summary:
    "Decida qual resultado a Meta deve procurar, quais sinais de público entregar e como organizar a campanha sem fragmentar o orçamento.",
  publicPreview:
    "A campanha na Meta começa pelo resultado do negócio. O objetivo do Ads Manager, o público e a estrutura vêm depois, nessa ordem.",
  estimatedMinutes: 35,
  accessType: "PAID" as const,
  priceCents: 3990,
  commerceStatus: "NOT_FOR_SALE" as const,
};

export type Lesson09Block = {
  blockKey: string;
  position: number;
  countsForProgress: boolean;
  required: boolean;
  data: LessonBlockData;
};

function block(
  position: number,
  blockKey: string,
  countsForProgress: boolean,
  required: boolean,
  data: LessonBlockData,
): Lesson09Block {
  return { position, blockKey, countsForProgress, required, data };
}

const heading = (position: number, blockKey: string, text: string) =>
  block(position, blockKey, false, false, { type: "HEADING", level: 2, text });

export const lesson09Blocks: Lesson09Block[] = [
  heading(1, "campanha-comeca-pelo-resultado", "A campanha começa pelo resultado"),
  block(2, "cadeia-do-resultado", true, false, {
    type: "TEXT",
    body: `A campanha não começa escolhendo interesses.

A ordem é esta:

objetivo do negócio → objetivo da Meta → local da conversão → público → estrutura → criativos → resultado.

O criativo vem depois. Sem um resultado claro, o anúncio não tem o que procurar.`,
  }),
  block(3, "negocio-nao-e-o-botao", false, false, {
    type: "CALLOUT",
    tone: "info",
    title: "O negócio e o botão não são a mesma coisa",
    body: "“Quero receber pedidos de orçamento” é o objetivo do negócio. O objetivo da Meta é o que você escolhe no Ads Manager. A conversão é o fato mensurável: lead, mensagem, compra, cadastro, visita qualificada ou outro resultado que você consiga reconhecer.",
  }),
  heading(4, "os-seis-objetivos", "Os seis objetivos atuais"),
  block(5, "cada-objetivo-em-uma-frase", true, false, {
    type: "TEXT",
    body: `O Ads Manager trabalha hoje com seis objetivos.

Reconhecimento procura pessoas com mais chance de lembrar do anúncio. Faz sentido para apresentar o negócio. Não combina quando o que você quer agora é contato ou venda.

Tráfego manda pessoas a um destino, como site, página ou app. Otimiza a visita. Não escolha Tráfego só porque a frase superficial é “mandar gente para o site”. Pergunte o que elas devem fazer depois.

Engajamento procura interação, mensagem ou uma ação no anúncio ou na página. Não significa que conversa no WhatsApp seja sempre Engajamento.

Leads procura quem pode deixar um contato, por mensagem, ligação ou cadastro. O destino exato depende da configuração.

Promoção do app procura instalação ou uma ação dentro do aplicativo.

Vendas procura quem tem mais chance de comprar ou de fazer outra ação comercial, como adicionar ao carrinho. Escolher Vendas não produz a venda. A Meta precisa de sinais suficientes para otimizar esse resultado.`,
  }),
  block(6, "tres-niveis-da-campanha", false, false, {
    type: "EXAMPLE",
    title: "Três níveis, um resultado",
    body: `Campanha: o objetivo e as decisões desse nível, inclusive a estratégia de orçamento quando ela aparece ali.

Conjunto de anúncios: público, entrega, posicionamentos e a otimização que estiver nesse nível.

Anúncio: criativo, mensagem e destino.

O público só entra depois que o resultado está escolhido.`,
  }),
  block(7, "trafego-visita-ou-resultado", true, false, {
    type: "TEXT",
    body: `Tráfego não é uma escolha ruim. É uma escolha de visita.

Se o resultado real é compra, lead ou cadastro, e você já consegue medir esse fato, outro objetivo pode ser mais coerente. A diferença é o que a entrega tenta conseguir: a chegada na página, ou o resultado comercial.

Ainda assim, uma visita qualificada pode ser o resultado honesto de uma campanha que ainda não tem evento de compra.`,
  }),
  block(8, "conversa-nao-escolhe-o-objetivo", false, false, {
    type: "CALLOUT",
    tone: "warning",
    title: "Conversa não escolhe o objetivo sozinha",
    body: "A documentação atual mostra que mensagens, inclusive WhatsApp, podem ser configuradas em mais de um objetivo, conforme o local da conversão. Nesta aula, registre que o negócio quer conversas. A aula seguinte trata a configuração de leads e WhatsApp com a interface atual.",
  }),
  block(9, "leads-vendas-e-app", true, false, {
    type: "TEXT",
    body: `Leads, do jeito que o Help Center descreve hoje, coleta contatos por mensagens, ligações ou cadastros. Formulário, site e outros destinos só entram se a configuração daquele objetivo os oferecer. Esta aula não abre essa tela.

Vendas encontra pessoas com chance de comprar um produto ou serviço, ou de cumprir outra ação comercial. Sem evento medido, o objetivo não ganha o sinal que precisa.

Promoção do app fica para quem tem um aplicativo. Não use esse objetivo para uma página ou um WhatsApp.`,
  }),
  block(10, "nomes-antigos", false, false, {
    type: "CALLOUT",
    tone: "tip",
    title: "Materiais antigos usam outros nomes",
    body: "O Help Center ainda mostra a tabela dos objetivos antigos, como brand awareness, mensagens e conversões, mapeados para os seis atuais. Use essa tabela só para traduzir um tutorial velho. A estrutura da campanha nova é a dos seis.",
  }),
  block(11, "checkpoint-objetivo", true, true, {
    type: "CHECKPOINT",
    question: "Uma marcenaria quer pedidos de orçamento e consegue registrar o contato. O que vem primeiro?",
    options: [
      { id: "resultado", label: "O resultado do negócio e a conversão que será medida" },
      { id: "interesses", label: "Uma lista de interesses de decoração" },
      { id: "instagram", label: "Escolher só o Instagram porque o público parece estar lá" },
    ],
    correctOptionId: "resultado",
    explanation: "Interesse e posicionamento são decisões posteriores. Sem o resultado, a Meta não sabe o que procurar.",
  }),
  heading(12, "publico-nao-comeca-no-interesse", "O público não começa no interesse"),
  block(13, "controle-versus-sugestao", true, false, {
    type: "TEXT",
    body: `O modelo antigo pedia que você descobrisse todos os interesses da pessoa. O modelo atual pede outra coisa: definir os controles necessários, entregar sinais úteis quando existirem e deixar o sistema procurar dentro da estratégia.

Advantage+ audience, também chamado de público com Advantage+ ligado, usa a inteligência da Meta para encontrar quem tende a responder. Isso não apaga o público. Muda o que é limite e o que é pista.

Controle é um limite que a entrega deve respeitar. Na ajuda atual, os controles são localização, idade mínima, idiomas e exclusão de públicos personalizados. Existe uma opção separada para ampliar a localização. Se você não ligar essa opção, a área escolhida continua sendo o limite.

Sugestão orienta a busca. Idade além do mínimo, gênero, segmentação detalhada e públicos personalizados de inclusão são sugestões. A Meta pode entregar fora delas se entender que isso melhora o resultado. Há também um caminho para limitar mais o alcance. Quando esse caminho está ligado, parte do que era sugestão passa a restringir. Não trate todo campo como trava rígida.`,
  }),
  block(14, "interesse-continua-util", false, false, {
    type: "CALLOUT",
    tone: "info",
    title: "Interesse não morreu e também não prova cliente",
    body: "Interesse continua sendo um sinal possível. Não é uma lista mágica. Gostar de decoração não significa estar pronto para comprar móveis planejados.",
  }),
  block(15, "local-idade-idioma", true, false, {
    type: "TEXT",
    body: `Localização é decisão de negócio. Um serviço presencial em Belém precisa cobrir a área realmente atendida. Um curso digital pode falar com o Brasil. Encolher o mapa só para parecer segmentado reduz a entrega sem melhorar a estratégia.

Idade mínima só vira controle quando existe uma razão real para impedir a entrega abaixo dela. “Acho que meu cliente tem 30 anos” é suposição. “Não atendo menores” pode ser restrição.

Idioma entra como controle quando a campanha precisa ser compreendida numa língua. Não invente restrição para parecer preciso.`,
  }),
  block(16, "moveis-em-belem", false, false, {
    type: "EXAMPLE",
    title: "Móveis planejados em Belém",
    body: `O negócio quer pedidos de orçamento. Esse é o resultado. O objetivo da Meta depende de onde o contato acontece e de a mensuração existir.

A geografia é a área atendida, não um bairro escolhido para parecer nicho.

Decoração, arquitetura e design de interiores podem ser sugestões. Não provam intenção de compra. A estrutura inicial fica simples: um conjunto com um propósito, em vez de um conjunto para cada interesse.`,
  }),
  block(17, "curso-no-brasil", false, false, {
    type: "EXAMPLE",
    title: "Curso de tráfego pago no Brasil",
    body: `O resultado é um novo aluno ou um lead do curso. A geografia pode ser o Brasil, se a oferta atende o país.

Fragmentar dezenas de interesses divide o orçamento e dificulta a leitura. Sinais curtos, quando existirem, orientam o começo. Não substituem a oferta nem a página.`,
  }),
  block(18, "audiencias-proprias", true, false, {
    type: "TEXT",
    body: `Público personalizado é um conceito: pessoas que já tiveram relação com o negócio. Visitantes, leads, clientes, engajamento ou uma lista própria permitida podem ser essa fonte, quando a base é adequada.

Público semelhante parte de uma fonte e procura pessoas parecidas. Percentuais como 1%, 2% ou 3% não são fórmula. A campanha não precisa de lookalike para funcionar.

Exclusão faz sentido em casos reais: tirar clientes de uma campanha de aquisição, evitar uma sobreposição operacional, separar públicos que não devem se misturar. Exclusão em excesso só reduz a entrega.

Público amplo também pode ser estratégia, quando o objetivo está coerente, o evento é medido, o criativo comunica e o orçamento não está picado. Não é regra para toda campanha. A própria Meta não recomenda Advantage+ audience para uma campanha cujo propósito é só remarketing.`,
  }),
  block(19, "nao-envie-lista-aqui", false, false, {
    type: "CALLOUT",
    tone: "warning",
    title: "Esta aula não recebe lista de clientes",
    body: "Não envie CPF, telefone, e-mail ou identificador de pessoa. Também não envie ID de público, pixel ou token. O plano descreve a estratégia. A integração com a Meta não faz parte desta ferramenta.",
  }),
  block(20, "publico-amplo", true, false, {
    type: "TEXT",
    body: `Um conjunto amplo, com controles certos e poucos sinais, costuma ser mais legível do que vários conjuntos quase iguais.

Não faça uma campanha por interesse. Não faça um conjunto por idade. Mais conjuntos não significam mais teste. Com orçamento pequeno, fragmentar custa a chance de a entrega aprender e a sua chance de ler o resultado.

Não existe um número universal de conjuntos. Se o dinheiro fica muito dividido, simplifique.`,
  }),
  heading(21, "posicionamentos", "Onde o anúncio pode aparecer"),
  block(22, "advantage-plus-placements", true, false, {
    type: "TEXT",
    body: `A ajuda atual recomenda Advantage+ placements porque o sistema tenta usar o orçamento nas superfícies elegíveis. Escolher manualmente não é erro. É uma exceção com motivo.

Motivos concretos: criativo incompatível, restrição operacional, teste controlado, requisito específico ou formato inadequado. “Meu público está no Instagram” não basta, se isso não veio de dado da conta.

Feed, Stories e Reels são experiências diferentes. Ampliar posicionamentos pede criativo que caiba neles. A peça em si fica para outra conversa. Aqui, a decisão é se a entrega pode procurar essas superfícies.`,
  }),
  block(23, "manual-precisa-de-motivo", false, false, {
    type: "CALLOUT",
    tone: "warning",
    title: "Manual sem motivo não é controle",
    body: "Se a estratégia for posicionamento manual, escreva o motivo. Sem isso, o plano ainda não decidiu onde o anúncio pode aparecer.",
  }),
  block(24, "criativo-muda-com-a-superficie", true, false, {
    type: "TEXT",
    body: `Stories e Reels pedem uma peça vertical. O feed aceita outra proporção. Se o único arquivo é um banner horizontal, ligar todas as superfícies não melhora o anúncio.

Anote a limitação no plano. Não finja que o mesmo arquivo serve para tudo.`,
  }),
  heading(25, "orcamento-da-campanha", "Onde o orçamento mora"),
  block(26, "estrategia-de-orcamento", true, false, {
    type: "TEXT",
    body: `Use o orçamento mensal que você já definiu. A referência diária só distribui esse valor em 30 dias. Não é o gasto que a plataforma vai fazer.

No Ads Manager, para Vendas, Leads e Promoção do app, a estratégia de orçamento aparece no nível da campanha. As duas opções atuais são orçamento da campanha e orçamento do conjunto.

Orçamento da campanha, o que materiais antigos chamavam de CBO e a Meta também associa ao Advantage+ campaign budget, distribui o valor entre os conjuntos. Com um conjunto só, a ajuda oficial diz que o efeito prático é o mesmo do orçamento do conjunto.

Orçamento do conjunto fixa o valor em cada conjunto. Isso ajuda quando cada conjunto precisa de um limite próprio. Não ligue a distribuição automática só porque ela existe.`,
  }),
  block(27, "fragmentar-custa-caro", false, false, {
    type: "CALLOUT",
    tone: "tip",
    title: "Orçamento pequeno sofre com estrutura grande",
    body: "Quanto menor o orçamento, maior o custo de dividir a campanha demais. Uma estrutura simples concentra o dinheiro, facilita a leitura e deixa a decisão mais clara. Isso não vira uma fórmula de quantos conjuntos cabem em cada real.",
  }),
  block(28, "checkpoint-estrutura", true, true, {
    type: "CHECKPOINT",
    question: "O orçamento mensal é pequeno e a oferta é uma só. Qual estrutura inicial ajuda mais a leitura?",
    options: [
      { id: "simples", label: "Um conjunto com propósito claro e controles necessários" },
      { id: "idade", label: "Um conjunto para cada faixa de idade" },
      { id: "interesse", label: "Uma campanha para cada interesse" },
    ],
    correctOptionId: "simples",
    explanation: "Mais conjuntos não tornam o teste mais sofisticado. Com pouco orçamento, a fragmentação dificulta aprender e ler.",
  }),
  block(29, "atividade-primeiro-conjunto", true, true, {
    type: "ACTIVITY",
    prompt:
      "Descreva, em uma frase, o resultado que a Meta deve procurar e quem fica de fora por um motivo real, como área não atendida ou cliente que não deve ver uma campanha de aquisição.",
    inputType: "long_text",
  }),
  block(30, "checklist-antes-do-plano", true, true, {
    type: "CHECKLIST",
    items: [
      { id: "resultado", label: "O objetivo da Meta combina com o resultado do negócio." },
      { id: "area", label: "A localização cobre a área realmente atendida." },
      { id: "sinais", label: "Os sinais são sugestões, não uma lista mágica de interesses." },
      { id: "manual", label: "Se o posicionamento for manual, existe um motivo." },
      { id: "medida", label: "A mensuração do resultado foi revista, mesmo que ainda tenha pendência." },
    ],
  }),
  block(31, "mensuracao-e-pendencia", true, false, {
    type: "TEXT",
    body: `Se a aula de destino já mostrou um problema crítico de mensuração, o plano continua podendo ser salvo. O status fica em preparação.

O diagnóstico de prontidão também é contexto. Se ele indicou Google, Meta ou os dois, isso aparece como orientação. Não impede esta aula.

Sem as aulas anteriores, preencha só o que falta: oferta, resultado, conversão, destino e orçamento. Não é obrigatório voltar.`,
  }),
  block(32, "plano-inicial-meta", true, true, {
    type: "TOOL",
    toolKey: "META_CAMPAIGN_BLUEPRINT_V1",
    title: "Plano inicial de campanha Meta",
    description:
      "Registre o resultado do negócio, o objetivo da Meta, o caminho da conversão e a estrutura dos conjuntos. O plano não cria campanha, não pede token e não publica anúncio.",
  }),
  block(33, "checkpoint-plano-coerente", true, true, {
    type: "CHECKPOINT",
    question: "Quando este plano está pronto para a configuração?",
    options: [
      { id: "sustenta", label: "Quando objetivo, público, destino e mensuração se sustentam" },
      { id: "texto", label: "Quando o texto do plano ficou bonito" },
      { id: "advantage", label: "Quando todas as opções Advantage+ estão ligadas" },
    ],
    correctOptionId: "sustenta",
    explanation: "Advantage+ é uma ferramenta da entrega, não a prova de que a campanha está pronta. A prontidão é a coerência do plano.",
  }),
  block(34, "conclusao-arquitetura", false, false, {
    type: "CONCLUSION",
    body: "Você sabe qual resultado quer que a Meta procure, quais sinais de público entregar e como organizar a campanha sem complicar além da conta. Se a mensuração ou o destino ainda não sustentam essa frase, o próximo passo é resolver a pendência, não publicar.",
  }),
  block(35, "proxima-aula-leads", false, false, {
    type: "CALLOUT",
    tone: "info",
    title: "A próxima aula configura leads e WhatsApp",
    body: "Crie campanhas para leads e WhatsApp usa este plano: objetivo do negócio, objetivo da Meta, caminho da conversão, conjuntos, destino e orçamento.",
  }),
  block(36, "diagnostico-nao-bloqueia", true, false, {
    type: "TEXT",
    body: `O plano que você salvar fica no projeto e não abre uma campanha na Meta.

Se o diagnóstico apontou outro canal, use esta aula mesmo assim. A indicação ajuda a decidir por onde começar. Não trava o estudo.`,
  }),
];
