import type { LessonBlockData } from "@/lib/learning/blocks";

export const LESSON_03_SLUG = "negocio-pronto-para-anunciar";

export const lesson03Meta = {
  title: "Seu negócio está pronto para anunciar?",
  summary:
    "Descubra quais fundamentos do seu negócio já estão preparados para receber tráfego pago, identifique o principal gargalo e saiba qual deve ser o próximo passo antes de aumentar o investimento.",
  publicPreview:
    "Antes de criar uma campanha, vale verificar se objetivo, oferta, público, destino, mensuração e atendimento estão preparados. Nesta aula você fará um diagnóstico aplicado ao seu próprio negócio.",
  estimatedMinutes: 20,
  accessType: "FREE" as const,
  priceCents: null,
  commerceStatus: "NOT_FOR_SALE" as const,
};

export type Lesson03Block = {
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
): Lesson03Block {
  return { position, blockKey, countsForProgress, required, data };
}

const heading = (position: number, blockKey: string, text: string) =>
  block(position, blockKey, false, false, { type: "HEADING", level: 2, text });

export const lesson03Blocks: Lesson03Block[] = [
  heading(1, "antes-de-criar-campanha", "Antes de criar a campanha"),
  block(2, "campanha-comeca-antes-gerenciador", true, false, {
    type: "TEXT",
    body: `Uma campanha começa antes de você abrir o Google Ads ou o Gerenciador de Anúncios da Meta.

Antes de escolher palavras-chave, públicos, criativos ou orçamento, existe uma pergunta mais importante:

“Meu negócio está preparado para transformar tráfego em oportunidades?”

Isso não significa que tudo precisa estar perfeito.

Significa que alguns fundamentos precisam existir ou, pelo menos, estar claros o suficiente para que o investimento gere aprendizado útil.

Imagine duas empresas anunciando o mesmo serviço.

A primeira sabe:

- o que quer vender;
- quem provavelmente compra;
- para onde levar o cliente;
- qual ação deseja gerar;
- como medir o contato;
- quem responderá ao lead.

A segunda apenas decidiu:

“Vamos fazer anúncios.”

Mesmo utilizando a mesma plataforma, as duas começam em situações muito diferentes.

Nesta aula você vai descobrir em qual situação o seu negócio está.`,
  }),
  block(3, "prontidao-nao-e-perfeicao", true, false, {
    type: "CALLOUT",
    tone: "info",
    title: "Prontidão não significa perfeição",
    body: `Você não precisa ter uma operação perfeita para começar a anunciar.

O objetivo é identificar se existe alguma falha importante que deveria ser resolvida antes de colocar mais dinheiro na aquisição de tráfego.

Um diagnóstico útil não serve apenas para dizer “sim” ou “não”.

Ele serve para mostrar:

“qual é o próximo problema que vale resolver?”`,
  }),
  heading(4, "seis-dimensoes-prontidao", "As seis dimensões da prontidão"),
  block(5, "dimensao-objetivo", true, false, {
    type: "TEXT",
    body: `1. Objetivo

Uma campanha precisa estar ligada a algum resultado esperado.

Receber contatos, gerar vendas, conseguir agendamentos, levar pessoas até uma loja ou iniciar conversas pelo WhatsApp são exemplos de objetivos mais concretos.

“Quero aparecer mais” pode até fazer parte de uma estratégia, mas ainda precisa ser traduzido em algo que possa orientar decisões.

Quando o objetivo é indefinido, fica difícil decidir:

- qual campanha criar;
- o que medir;
- onde investir;
- quando considerar que o teste funcionou.`,
  }),
  block(6, "dimensao-oferta", true, false, {
    type: "TEXT",
    body: `2. Oferta

Tráfego pago leva pessoas até alguma coisa.

Essa “coisa” precisa estar minimamente clara.

Pode ser:

- um serviço;
- um produto;
- uma consulta;
- uma matrícula;
- um orçamento;
- uma promoção;
- uma condição específica.

Se a empresa tenta anunciar tudo ao mesmo tempo sem saber qual oferta priorizar, a comunicação tende a perder força.

Também importa responder:

“Por que alguém deveria escolher esta oferta?”

Não precisa existir uma frase perfeita de marketing.

Mas precisa existir algum valor que o cliente consiga compreender.`,
  }),
  block(7, "dimensao-publico", true, false, {
    type: "TEXT",
    body: `3. Público

Você não precisa conhecer cada detalhe do seu cliente antes de começar.

Mas é importante conseguir descrever, ao menos de forma razoável:

- quem costuma comprar;
- qual problema essa pessoa tenta resolver;
- em que contexto ela procura ou descobre a solução.

Essa informação influencia a escolha do canal, da mensagem e da oferta.

Um dos objetivos da Aula 2 foi justamente começar a observar se o cliente:

- já procura pela solução;
- precisa descobrir a oferta;
- ou pode chegar pelos dois caminhos.`,
  }),
  block(8, "dimensao-destino", true, false, {
    type: "TEXT",
    body: `4. Destino

Depois do anúncio, a pessoa precisa chegar a algum lugar.

Pode ser:

- landing page;
- site;
- WhatsApp;
- Instagram;
- página de produto;
- marketplace.

Não existe um único destino correto para todos os negócios.

Mas existe uma pergunta importante:

“A pessoa consegue entender o que estou oferecendo e o que deve fazer em seguida?”

Uma campanha pode estar bem configurada e ainda assim perder oportunidades porque o destino:

- demora;
- confunde;
- não funciona bem no celular;
- esconde o contato;
- não explica a oferta.`,
  }),
  block(9, "dimensao-mensuracao", true, false, {
    type: "TEXT",
    body: `5. Mensuração

Se uma campanha gera contatos, vendas ou agendamentos, você precisa conseguir identificar isso de alguma forma.

Sem mensuração, decisões passam a depender de impressão:

“Parece que melhorou.”

“Acho que veio mais gente.”

“Talvez esses clientes tenham vindo do anúncio.”

Quanto melhor a mensuração, mais segurança existe para decidir:

- continuar;
- reduzir;
- aumentar;
- testar outra abordagem;
- ou parar.

Ferramentas como Google Ads, Google Analytics e Meta Pixel podem participar dessa estrutura, dependendo da campanha.

Você não precisa dominar todas elas agora.

Mas precisa reconhecer que medir faz parte do trabalho.`,
  }),
  block(10, "dimensao-operacao", true, false, {
    type: "TEXT",
    body: `6. Operação

Imagine que a campanha funciona.

Cinco pessoas entram em contato.

Quem responde?

Quanto tempo demora?

Existe alguém acompanhando os pedidos?

A equipe sabe o que fazer?

Uma campanha pode resolver o problema de falta de tráfego e revelar outro problema:

a empresa não consegue transformar a oportunidade em atendimento.

Por isso, capacidade operacional também faz parte da prontidão.

Tráfego e atendimento não são o mesmo trabalho, mas um influencia diretamente o valor do outro.`,
  }),
  block(11, "checkpoint-prontidao-estrutura", true, true, {
    type: "CHECKPOINT",
    question: "Qual situação apresenta o maior risco de investir em tráfego sem conseguir avaliar o resultado?",
    options: [
      { id: "orcamento-pequeno", label: "A. A empresa ainda possui um orçamento pequeno." },
      { id: "nunca-anunciou", label: "B. A empresa nunca anunciou antes." },
      { id: "sem-identificar-resultado", label: "C. A empresa não consegue identificar quando um anúncio gera contato ou venda." },
      { id: "um-produto", label: "D. A empresa possui apenas um produto principal." },
    ],
    correctOptionId: "sem-identificar-resultado",
    explanation:
      "Sem alguma forma de relacionar campanha e resultado, fica muito mais difícil saber o que funcionou, o que deve ser ajustado e se o investimento fez sentido.",
  }),
  block(12, "exemplo-nota-nao-conta-tudo", true, false, {
    type: "EXAMPLE",
    title: "Uma empresa pode parecer pronta e ainda ter um bloqueio importante",
    body: `Imagine uma empresa com:

- oferta clara;
- público conhecido;
- bom site;
- atendimento rápido;
- orçamento definido.

Ela parece muito bem preparada.

Mas existe um problema:

ninguém consegue identificar quais contatos vieram dos anúncios.

Mesmo que o restante da estrutura esteja bom, existe um gargalo relevante de mensuração.

É por isso que o diagnóstico desta plataforma não olha apenas para uma média geral.

Algumas respostas podem revelar problemas que merecem prioridade mesmo quando a nota total parece razoável.`,
  }),
  heading(13, "nota-nao-e-diagnostico", "A nota não é a parte mais importante"),
  block(14, "score-e-gargalo", true, false, {
    type: "TEXT",
    body: `Ao terminar o diagnóstico, você receberá uma pontuação geral de prontidão.

Ela ajuda a resumir a situação.

Mas não use essa nota como se fosse uma prova.

Uma empresa com 75 pontos pode ter um problema importante de mensuração.

Outra com 58 pontos pode ter vários ajustes simples e nenhum bloqueio grave.

Por isso, observe principalmente:

- principal gargalo;
- pontos fortes;
- pontos de atenção;
- próxima ação recomendada.

A pergunta mais útil não é:

“Minha nota foi boa?”

É:

“O que devo resolver primeiro?”`,
  }),
  block(15, "gargalo-antes-da-media", true, false, {
    type: "CALLOUT",
    tone: "info",
    title: "Resolva a dependência anterior",
    body: `Se você ainda não sabe o que vai anunciar, configurar ferramentas avançadas de mensuração provavelmente não é o primeiro problema.

Se a oferta está clara, mas você não consegue medir nenhum resultado, a mensuração pode passar a ser prioridade.

A ordem das ações importa.`,
  }),
  heading(16, "faca-seu-diagnostico", "Faça o diagnóstico do seu negócio"),
  block(17, "diagnostico-prontidao-trafego", true, true, {
    type: "TOOL",
    toolKey: "TRAFFIC_READINESS_V1",
    title: "Diagnóstico de Prontidão para Tráfego",
    description: `Agora vamos aplicar o que você aprendeu ao seu próprio negócio.

O diagnóstico possui 15 perguntas distribuídas entre:

- objetivo;
- oferta;
- público;
- destino;
- mensuração;
- operação.

Leva aproximadamente de 4 a 6 minutos.

Ao final, você receberá:

- visão geral da prontidão;
- principal gargalo;
- pontos fortes;
- pontos de atenção;
- próxima recomendação;
- indicação inicial de canal quando houver informação suficiente.`,
  }),
  heading(18, "como-ler-resultado", "Como interpretar o resultado"),
  block(19, "interpretando-diagnostico", true, false, {
    type: "TEXT",
    body: `Depois de concluir o diagnóstico, não tente resolver tudo ao mesmo tempo.

Comece pelo principal gargalo indicado.

Se o resultado apontar problema em objetivo ou oferta, talvez ainda seja cedo para se preocupar com detalhes avançados de campanha.

Se o problema estiver no destino, pode ser necessário preparar melhor a página, o WhatsApp ou outro ponto de conversão.

Se o gargalo estiver em mensuração, talvez a prioridade seja descobrir como acompanhar os resultados antes de aumentar o investimento.

Se a operação estiver fraca, gerar mais leads pode apenas aumentar a quantidade de contatos mal atendidos.

O diagnóstico deve reduzir a quantidade de decisões concorrendo pela sua atenção.`,
  }),
  block(20, "checkpoint-score-gargalo", true, true, {
    type: "CHECKPOINT",
    question: "Seu diagnóstico mostrou 78/100, mas indicou mensuração como gargalo crítico. Qual decisão faz mais sentido?",
    options: [
      { id: "ignorar-gargalo", label: "A. Ignorar o gargalo porque a nota ficou próxima de 80." },
      { id: "aumentar-orcamento", label: "B. Aumentar imediatamente o orçamento." },
      { id: "corrigir-mensuracao", label: "C. Entender e corrigir a mensuração antes de usar a nota geral como sinal para escalar." },
      { id: "repetir-nota", label: "D. Fazer o diagnóstico novamente até conseguir uma nota maior." },
    ],
    correctOptionId: "corrigir-mensuracao",
    explanation:
      "A pontuação geral ajuda a resumir a situação, mas não deve esconder uma dependência importante. Um gargalo crítico pode merecer atenção antes de aumentar o investimento.",
  }),
  heading(21, "diagnostico-vira-acao", "Um diagnóstico só tem valor quando vira ação"),
  block(22, "proximo-passo-diagnostico", true, false, {
    type: "TEXT",
    body: `Depois do diagnóstico, a plataforma pode recomendar diferentes tipos de próximo passo.

Aprender

Quando falta conhecimento para executar algo com segurança.

Executar

Quando você já possui informação suficiente e precisa realizar uma ação.

Analisar

Quando existem dados que precisam ser avaliados antes da próxima decisão.

Aguardar

Quando mexer novamente agora pode ser pior do que esperar dados ou uma data planejada.

A opção “aguardar” é tão importante quanto as outras.

Otimizar não significa alterar alguma coisa todos os dias.

Às vezes, a decisão mais profissional é não mexer ainda.`,
  }),
  block(23, "checklist-depois-diagnostico", false, false, {
    type: "CHECKLIST",
    items: [
      { id: "li-gargalo", label: "Li meu principal gargalo." },
      { id: "entendi-recomendacao", label: "Entendi a próxima recomendação." },
      { id: "sei-a-dimensao", label: "Sei qual dimensão precisa de mais atenção." },
      { id: "nota-nao-e-promessa", label: "Evitei interpretar a nota como promessa de resultado." },
      { id: "proximo-passo-claro", label: "Tenho um próximo passo mais claro do que antes." },
    ],
  }),
  heading(24, "se-nao-estiver-pronto", "E se meu negócio ainda não estiver pronto?"),
  block(25, "nao-pronto-nao-e-fracasso", true, false, {
    type: "TEXT",
    body: `Descobrir que ainda não é hora de aumentar o investimento não significa que o diagnóstico “deu errado”.

Na verdade, pode ser uma das respostas mais valiosas.

Imagine descobrir isso antes de gastar:

- sua oferta ainda está confusa;
- ninguém acompanha os contatos;
- a página não funciona bem no celular;
- você não consegue medir nenhuma conversão.

É muito melhor descobrir esses pontos antes do que concluir, depois de gastar dinheiro, que:

“tráfego pago não funciona para minha empresa.”

Muitas vezes, a plataforma de anúncios não é o problema principal.

O sistema ao redor dela é que ainda precisa de preparação.`,
  }),
  block(26, "nao-anuncie-so-para-aprender-botao", true, false, {
    type: "CALLOUT",
    tone: "info",
    title: "Não tenha pressa de chegar ao botão “Publicar”",
    body: `Saber criar uma campanha tecnicamente é importante.

Mas escolher o que anunciar, preparar o destino, medir o resultado e saber o que fazer depois são partes igualmente importantes do trabalho.

O objetivo deste curso não é apenas ensinar onde clicar.

É ajudá-lo a tomar decisões melhores.`,
  }),
  block(27, "conclusao-aula-03", true, false, {
    type: "CONCLUSION",
    body: `Agora você sabe onde começar

Nas três primeiras aulas você construiu uma base importante.

Na Aula 1, entendeu como o tráfego pago funciona e criou seu primeiro mapa.

Na Aula 2, analisou Google Ads e Meta Ads e registrou uma indicação inicial de canal.

Agora você avaliou a prontidão do seu próprio negócio.

A partir daqui, sua jornada não precisa ser igual à de todos os outros alunos.

Se o principal gargalo estiver em objetivo ou oferta, o próximo conteúdo mais útil pode ser:

“Defina objetivo, oferta e orçamento.”

Se o problema estiver em destino ou mensuração, pode fazer mais sentido:

“Prepare o destino e a mensuração.”

Se a sua base já estiver consistente, você poderá avançar para a implementação do canal mais coerente com sua estratégia.

Use o diagnóstico como orientação.

A sequência do curso continua sendo recomendada, não obrigatória.`,
  }),
];
