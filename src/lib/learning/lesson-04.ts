import type { LessonBlockData } from "@/lib/learning/blocks";

export const LESSON_04_SLUG = "objetivo-oferta-orcamento";

export const lesson04Meta = {
  title: "Defina objetivo, oferta e orçamento",
  summary:
    "Transforme a ideia de “quero anunciar” em um plano inicial de campanha, definindo o objetivo, a oferta, a conversão e um orçamento coerente com a realidade do negócio.",
  publicPreview:
    "Antes de criar anúncios, você precisa saber o que pretende promover, qual resultado realmente importa e quanto pode investir sem depender de uma promessa de retorno imediato. Nesta aula você construirá um Brief Inicial de Campanha aplicado ao seu próprio negócio.",
  estimatedMinutes: 30,
  accessType: "PAID" as const,
  priceCents: 2990,
  commerceStatus: "NOT_FOR_SALE" as const,
};

export type Lesson04Block = {
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
): Lesson04Block {
  return { position, blockKey, countsForProgress, required, data };
}

const heading = (position: number, blockKey: string, text: string) =>
  block(position, blockKey, false, false, { type: "HEADING", level: 2, text });

export const lesson04Blocks: Lesson04Block[] = [
  heading(1, "transformar-vontade-em-plano", "Transforme “quero anunciar” em um plano"),
  block(2, "antes-de-abrir-plataforma", true, false, {
    type: "TEXT",
    body: `Depois das três primeiras aulas, você já sabe como o tráfego funciona, analisou os canais e avaliou a prontidão do seu negócio.

Agora começamos a montar uma campanha de verdade.

Mas ainda não é hora de abrir o Google Ads ou o Gerenciador de Anúncios e começar a clicar.

Uma campanha precisa responder primeiro a três perguntas:

1. O que exatamente vou promover?
2. Qual resultado quero gerar?
3. Quanto posso investir para testar essa hipótese?

Essas três decisões influenciam praticamente tudo que vem depois:

- mensagem;
- público;
- destino;
- mensuração;
- orçamento;
- avaliação dos resultados.

Nesta aula você transformará essas decisões em um Brief Inicial de Campanha.`,
  }),
  block(3, "campanha-e-hipotese", true, false, {
    type: "CALLOUT",
    tone: "info",
    title: "Uma campanha é uma hipótese",
    body: `Você está dizendo, em essência:

“Se eu apresentar esta oferta a este tipo de pessoa, neste contexto, usando este orçamento e este caminho de conversão, acredito que posso gerar determinada ação.”

A campanha serve também para testar essa hipótese.`,
  }),
  heading(4, "primeiro-objetivo", "Comece pelo resultado, não pelo botão"),
  block(5, "objetivo-de-negocio", true, false, {
    type: "TEXT",
    body: `Um erro comum é escolher o objetivo da campanha olhando primeiro para as opções disponíveis dentro da plataforma.

Antes disso, pense no negócio.

O que você realmente quer que aconteça?

Exemplos:

- receber solicitações de orçamento;
- gerar agendamentos;
- vender um produto;
- iniciar conversas no WhatsApp;
- receber inscrições;
- levar pessoas até uma loja;
- gerar leads para uma equipe comercial.

Depois, esse objetivo de negócio será traduzido para a configuração técnica da plataforma.

Não faça o caminho inverso.

“Tráfego”, “alcance” ou “engajamento” podem ser objetivos técnicos úteis em determinados contextos, mas não substituem a clareza sobre o resultado comercial esperado.`,
  }),
  block(6, "checkpoint-objetivo-negocio", true, true, {
    type: "CHECKPOINT",
    question: "Qual opção abaixo representa melhor um objetivo de negócio claro?",
    options: [
      { id: "usar-google-ads", label: "Usar Google Ads." },
      { id: "mais-impressoes", label: "Ter mais impressões." },
      { id: "orcamento-pelo-whatsapp", label: "Receber solicitações de orçamento pelo WhatsApp." },
      { id: "aumentar-orcamento-diario", label: "Aumentar o orçamento diário." },
    ],
    correctOptionId: "orcamento-pelo-whatsapp",
    explanation:
      "A opção descreve uma ação concreta que tem valor para o negócio. Plataforma, impressões e orçamento são elementos da execução, não o resultado comercial em si.",
  }),
  heading(7, "defina-conversao", "Qual ação vai representar sucesso?"),
  block(8, "objetivo-vs-conversao", true, false, {
    type: "TEXT",
    body: `Objetivo e conversão estão relacionados, mas não são exatamente a mesma coisa.

Imagine:

Objetivo:
gerar novas oportunidades comerciais.

Conversão:
envio do formulário de orçamento.

Ou:

Objetivo:
aumentar agendamentos.

Conversão:
início de uma conversa qualificada no WhatsApp ou agendamento concluído.

A conversão é a ação observável que ajuda você a saber se a campanha está aproximando o negócio do objetivo.

Por isso, antes de anunciar, termine esta frase:

“Vou considerar que a campanha gerou uma oportunidade quando…”

Se você não consegue completar essa frase, a mensuração provavelmente ainda precisa de trabalho.`,
  }),
  block(9, "exemplo-objetivo-conversao", true, false, {
    type: "EXAMPLE",
    title: "Objetivo amplo demais x objetivo útil",
    body: `Situação 1:

“Quero divulgar minha clínica.”

Isso ainda é amplo.

Situação 2:

“Quero aumentar as solicitações de agendamento de ultrassonografia obstétrica.”

Agora existe uma direção.

Conversão possível:

“Paciente inicia atendimento pelo WhatsApp a partir da página do exame.”

A segunda formulação facilita decisões posteriores sobre anúncio, página e mensuração.`,
  }),
  heading(10, "escolha-oferta", "Escolha o que será anunciado"),
  block(11, "oferta-nao-e-empresa-inteira", true, false, {
    type: "TEXT",
    body: `Sua empresa pode vender muitas coisas.

Uma campanha não precisa apresentar todas elas ao mesmo tempo.

Quanto mais específica for a oferta inicial, mais fácil tende a ser:

- escrever o anúncio;
- escolher palavras-chave ou público;
- criar uma página coerente;
- medir a resposta;
- entender o que funcionou.

Uma escola pode oferecer dez cursos.

Uma clínica pode realizar dezenas de exames.

Uma loja pode ter centenas de produtos.

Isso não significa que a primeira campanha deva tentar promover tudo.

Pergunte:

“Qual oferta possui uma hipótese clara o suficiente para eu testar agora?”`,
  }),
  block(12, "oferta-nao-e-desconto", true, false, {
    type: "CALLOUT",
    tone: "info",
    title: "Oferta não significa necessariamente promoção",
    body: `“Oferta” aqui é aquilo que você apresenta ao mercado.

Pode ser um serviço pelo preço normal, uma consulta, um produto, uma avaliação, um orçamento ou uma condição específica.

Você não precisa dar desconto para ter uma oferta.`,
  }),
  block(13, "checkpoint-oferta-especifica", true, true, {
    type: "CHECKPOINT",
    question: "Uma escola oferece 15 cursos diferentes. Para um primeiro teste com orçamento limitado, qual abordagem tende a facilitar a análise?",
    options: [
      { id: "todos-os-cursos", label: "Anunciar os 15 cursos na mesma mensagem." },
      { id: "oferta-prioritaria", label: "Escolher uma oferta prioritária e construir a campanha em torno dela." },
      { id: "so-o-nome", label: "Não mencionar nenhum curso e divulgar apenas o nome da escola." },
      { id: "sem-decidir", label: "Criar uma campanha sem decidir a oferta." },
    ],
    correctOptionId: "oferta-prioritaria",
    explanation:
      "Uma oferta prioritária torna a mensagem, o destino e a mensuração mais claros e ajuda a entender melhor o que o investimento está testando.",
  }),
  heading(14, "destino-da-oferta", "Para onde a pessoa vai?"),
  block(15, "continuidade-anuncio-destino", true, false, {
    type: "TEXT",
    body: `A oferta apresentada no anúncio precisa continuar depois do clique.

Se o anúncio fala de um serviço específico e leva para uma página genérica onde o visitante precisa descobrir sozinho o que fazer, existe atrito.

Seu destino pode ser:

- uma landing page;
- uma página do site;
- WhatsApp;
- página de produto;
- formulário;
- outro ambiente apropriado.

A pergunta central é:

“Esse destino ajuda a pessoa a continuar a ação que o anúncio começou?”

Na próxima aula paga, vamos aprofundar destino e mensuração.

Por enquanto, precisamos apenas registrá-lo no brief.`,
  }),
  heading(16, "quanto-investir", "Quanto investir?"),
  block(17, "orcamento-nao-e-numero-magico", true, false, {
    type: "TEXT",
    body: `Não existe um orçamento universal que funcione para todos os negócios.

R$ 300 podem ser suficientes para aprender algo em determinado contexto e insuficientes em outro.

R$ 3.000 podem ser muito ou pouco dependendo de:

- concorrência;
- mercado;
- região;
- valor da venda;
- objetivo;
- duração;
- canal;
- custo das oportunidades.

Por isso, a primeira pergunta não deveria ser:

“Qual é o orçamento ideal?”

E sim:

“Quanto meu negócio pode investir neste teste sem depender de um retorno garantido e imediato?”

Esse valor precisa ser financeiramente suportável e grande o suficiente para permitir algum aprendizado.`,
  }),
  block(18, "dinheiro-de-teste", true, false, {
    type: "CALLOUT",
    tone: "info",
    title: "Não use dinheiro que precisa voltar amanhã",
    body: `Tráfego pago envolve incerteza.

Se o negócio depende de recuperar imediatamente cada real investido para cumprir uma obrigação urgente, a pressão pode levar a decisões ruins e interrupções prematuras.

Planeje o investimento como investimento de aquisição e aprendizado, não como retorno garantido.`,
  }),
  block(19, "mensal-para-diario", true, false, {
    type: "TEXT",
    body: `Uma forma simples de planejar é começar pelo valor mensal disponível e transformá-lo em referência diária.

Exemplo:

Orçamento mensal:
R$ 600

Referência simples:

R$ 600 ÷ 30 ≈ R$ 20 por dia

Isso não significa que a plataforma obrigatoriamente gastará exatamente R$ 20 em cada dia.

É apenas uma referência para visualizar a distribuição do orçamento.

Também ajuda a perceber situações como:

“Quero anunciar durante o mês inteiro, mas meu orçamento permite apenas R$ 5 por dia.”

Isso não torna a campanha automaticamente inviável.

Mas precisa entrar na análise da estratégia.`,
  }),
  block(20, "exemplo-orcamento-pequeno", true, false, {
    type: "EXAMPLE",
    title: "Um orçamento pequeno não é automaticamente um erro",
    body: `Imagine um profissional que consegue investir R$ 300 no primeiro mês.

Dividindo por 30 dias, a referência seria aproximadamente R$ 10 por dia.

Talvez esse orçamento seja suficiente para um teste local muito específico.

Talvez não seja suficiente em um mercado extremamente concorrido.

A resposta não está apenas no número.

O importante é:

- reconhecer o limite;
- concentrar o teste;
- medir;
- não dividir o valor em campanhas demais;
- analisar o que os dados conseguem mostrar.`,
  }),
  block(21, "checkpoint-orcamento", true, true, {
    type: "CHECKPOINT",
    question: "Qual é a melhor forma de pensar o orçamento inicial?",
    options: [
      { id: "maior-valor", label: "Usar o maior valor possível, mesmo comprometendo despesas importantes." },
      { id: "copiar-outra", label: "Copiar o orçamento de outra empresa." },
      { id: "valor-sustentavel", label: "Definir um valor que o negócio consegue sustentar como teste e avaliar dentro do contexto da campanha." },
      { id: "sempre-dez", label: "Sempre começar com R$ 10 por dia." },
    ],
    correctOptionId: "valor-sustentavel",
    explanation: "Não existe um valor universal. O orçamento precisa considerar a realidade financeira, o mercado e a hipótese que será testada.",
  }),
  heading(22, "nao-pulverize", "Evite pulverizar demais o primeiro orçamento"),
  block(23, "concentracao-aprendizado", true, false, {
    type: "TEXT",
    body: `Quando o orçamento é limitado, existe uma tentação:

criar várias campanhas, testar Google, Meta, muitos produtos, públicos e anúncios ao mesmo tempo.

Isso parece sofisticado.

Mas pode dificultar o aprendizado.

Imagine R$ 300 divididos entre:

- Google;
- Instagram;
- três ofertas;
- dois públicos;
- quatro anúncios.

A quantidade de combinações cresce muito mais rápido que o orçamento.

Para um primeiro teste, normalmente é melhor existir uma hipótese clara e concentrada.

Depois, os dados podem justificar novas divisões.`,
  }),
  heading(24, "prazo-de-revisao", "Planeje quando você vai olhar novamente"),
  block(25, "revisao-planejada", true, false, {
    type: "TEXT",
    body: `Campanhas precisam ser acompanhadas.

Mas acompanhar não significa modificar tudo todos os dias.

Antes de começar, defina uma primeira data de revisão.

Ela serve para lembrar:

“Quando vou parar e avaliar o que aconteceu?”

Dependendo da campanha, alguns problemas podem exigir ação antes.

Por exemplo:

- anúncio reprovado;
- página quebrada;
- orçamento configurado incorretamente;
- erro de mensuração.

A data de revisão não é uma proibição de agir.

É um ponto planejado para análise.`,
  }),
  block(26, "brief-inicial-campanha", true, true, {
    type: "TOOL",
    toolKey: "CAMPAIGN_BRIEF_V1",
    title: "Monte seu Brief Inicial de Campanha",
    description: `Agora vamos reunir as decisões desta aula em um único plano.

Você definirá:

- oferta;
- objetivo;
- conversão principal;
- destino;
- orçamento mensal;
- referência diária;
- primeira data/período de revisão;
- ponto que ainda precisa ser validado.

O brief ficará vinculado ao projeto escolhido.`,
  }),
  heading(27, "como-usar-brief", "O brief não é um contrato com a campanha"),
  block(28, "brief-pode-mudar", true, false, {
    type: "TEXT",
    body: `O brief registra sua hipótese inicial.

Ele não precisa permanecer igual para sempre.

Você pode descobrir que:

- outra oferta responde melhor;
- o destino precisa mudar;
- o orçamento precisa ser ajustado;
- outra conversão representa melhor o resultado;
- o canal escolhido não era o mais adequado.

Isso não significa que o planejamento falhou.

Significa que novos dados alteraram a decisão.

O valor do brief está em permitir que você compare:

“O que eu pretendia testar?”

com:

“O que aconteceu de verdade?”

Sem um plano inicial, qualquer resultado corre o risco de parecer certo ou errado apenas pela sensação do momento.`,
  }),
  block(29, "checkpoint-final-brief", true, true, {
    type: "CHECKPOINT",
    question: "Qual alternativa representa melhor um bom Brief Inicial de Campanha?",
    options: [
      { id: "ver-o-que-acontece", label: "“Vou anunciar minha empresa e ver o que acontece.”" },
      { id: "hipotese-concreta", label: "“Vou promover uma oferta específica, buscando uma conversão definida, com um destino conhecido e um orçamento planejado.”" },
      { id: "duas-plataformas", label: "“Vou usar Google e Meta ao mesmo tempo porque são as plataformas mais conhecidas.”" },
      { id: "aumentar-ate-vender", label: "“Vou aumentar o orçamento até começar a vender.”" },
    ],
    correctOptionId: "hipotese-concreta",
    explanation: "O brief deve transformar uma intenção genérica de anunciar em uma hipótese concreta que depois possa ser executada e avaliada.",
  }),
  block(30, "conclusao-aula-04", true, false, {
    type: "CONCLUSION",
    body: `Agora existe uma campanha antes da campanha

Você ainda não criou anúncios.

E isso é positivo.

Antes de entrar na plataforma, você já definiu:

- o que pretende promover;
- qual resultado deseja;
- qual ação representa conversão;
- para onde levará o público;
- quanto pretende investir;
- quando fará a primeira revisão.

Esse conjunto de decisões forma seu Brief Inicial de Campanha.

Na próxima aula, vamos aprofundar duas partes que frequentemente determinam se os dados da campanha serão úteis:

destino e mensuração.

Próxima recomendação:

Prepare o destino e a mensuração.`,
  }),
];
