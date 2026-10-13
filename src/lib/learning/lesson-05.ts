import type { LessonBlockData } from "@/lib/learning/blocks";

export const LESSON_05_SLUG = "destino-e-mensuracao";

export const lesson05Meta = {
  title: "Prepare o destino e a mensuração",
  summary:
    "Prepare o caminho que o cliente percorrerá depois do clique e defina como identificar conversões e resultados antes de colocar a campanha no ar.",
  publicPreview:
    "Uma campanha pode gerar bons cliques e ainda perder oportunidades depois deles. Nesta aula você vai revisar o destino, definir a conversão principal e montar um plano simples de mensuração para o seu negócio.",
  estimatedMinutes: 35,
  accessType: "PAID" as const,
  priceCents: 3490,
  commerceStatus: "NOT_FOR_SALE" as const,
};

export type Lesson05Block = {
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
): Lesson05Block {
  return { position, blockKey, countsForProgress, required, data };
}

const heading = (position: number, blockKey: string, text: string) =>
  block(position, blockKey, false, false, { type: "HEADING", level: 2, text });

export const lesson05Blocks: Lesson05Block[] = [
  heading(1, "depois-do-clique", "O que acontece depois do clique?"),
  block(2, "clique-nao-encerra-campanha", true, false, {
    type: "TEXT",
    body: `Na Aula 4 você criou um Brief Inicial de Campanha.

Definiu o que pretende promover, qual resultado deseja gerar e quanto pretende investir.

Agora precisamos olhar para o próximo trecho do caminho:

o que acontece depois que alguém clica?

É possível criar um bom anúncio, alcançar a pessoa certa e ainda perder a oportunidade porque:

- a página confunde;
- o WhatsApp não funciona;
- a oferta do anúncio não aparece no destino;
- o formulário quebra;
- ninguém consegue identificar que a conversão aconteceu.

Uma campanha não termina no clique.

O clique apenas transfere a responsabilidade do anúncio para o próximo ponto da experiência.`,
  }),
  block(3, "destino-faz-parte-da-campanha", true, false, {
    type: "CALLOUT",
    tone: "info",
    title: "O destino também faz parte da campanha",
    body: `Se você paga para levar uma pessoa até uma página, WhatsApp ou formulário, a qualidade desse destino influencia diretamente o valor do clique que você comprou.

Não analise anúncio e destino como se fossem dois mundos independentes.`,
  }),
  heading(4, "funcao-do-destino", "O destino precisa continuar a conversa"),
  block(5, "tres-perguntas-destino", true, false, {
    type: "TEXT",
    body: `Um destino não precisa ser sofisticado para funcionar.

Mas deveria responder rapidamente a três perguntas para a pessoa.

1. Estou no lugar certo?

O que ela encontra depois do clique precisa combinar com aquilo que o anúncio prometeu.

2. O que está sendo oferecido?

A oferta precisa ser compreensível.

3. O que devo fazer agora?

A próxima ação precisa estar visível.

Imagine um anúncio dizendo:

“Agende sua ultrassonografia obstétrica.”

A pessoa clica e chega à página inicial de uma clínica com dezenas de exames e nenhum caminho evidente para agendamento.

O site pode ser bonito e tecnicamente correto.

Mesmo assim, existe atrito entre anúncio e destino.`,
  }),
  block(6, "exemplo-destino-coerente", true, false, {
    type: "EXAMPLE",
    title: "Anúncio e destino precisam falar sobre a mesma coisa",
    body: `Anúncio:

“Curso de Programação Web — novas turmas abertas.”

Destino ruim:

página inicial genérica da instituição, onde o aluno precisa procurar sozinho pelo curso.

Destino mais coerente:

página que apresenta o curso, duração, principais informações e uma ação clara para matrícula ou contato.

O segundo caminho reduz o trabalho que o visitante precisa fazer para entender a oferta.`,
  }),
  block(7, "checkpoint-destino-coerente", true, true, {
    type: "CHECKPOINT",
    question: "Um anúncio promove um serviço específico, mas envia o visitante para uma página genérica com dezenas de serviços. Qual é o principal risco?",
    options: [
      { id: "anuncio-mais-caro", label: "O anúncio obrigatoriamente ficará mais caro." },
      { id: "continuidade-da-oferta", label: "A pessoa pode não encontrar facilmente a continuidade da oferta que motivou o clique." },
      { id: "google-bloqueia", label: "O Google bloqueará automaticamente a campanha." },
      { id: "outro-dominio", label: "A empresa será obrigada a criar outro domínio." },
    ],
    correctOptionId: "continuidade-da-oferta",
    explanation:
      "O destino precisa continuar a expectativa criada pelo anúncio. Quanto mais esforço a pessoa precisa fazer para reencontrar a oferta, maior o risco de perder a oportunidade.",
  }),
  heading(8, "qual-destino-usar", "Landing page, site, WhatsApp ou outra opção?"),
  block(9, "destino-depende-do-caso", true, false, {
    type: "TEXT",
    body: `Não existe um único destino correto para todas as campanhas.

Uma landing page pode ser excelente quando você precisa:

- apresentar uma oferta específica;
- controlar a mensagem;
- remover distrações;
- medir um fluxo bem definido.

Uma página do site pode funcionar muito bem quando ela já responde às principais dúvidas e possui uma ação clara.

O WhatsApp pode reduzir etapas quando conversar com alguém faz parte natural da compra.

Uma página de produto pode ser o destino correto em um e-commerce.

Um formulário pode funcionar quando a coleta de informações é parte importante da qualificação.

A pergunta não é:

“Qual destino é mais profissional?”

A pergunta é:

“Qual destino permite que essa pessoa avance com clareza para a ação que eu quero medir?”`,
  }),
  block(10, "whatsapp-nao-corrige-oferta", true, false, {
    type: "CALLOUT",
    tone: "info",
    title: "WhatsApp não corrige uma proposta confusa",
    body: `Levar a pessoa diretamente para o WhatsApp reduz etapas, mas transfere parte da responsabilidade para o atendimento.

Se ninguém responde, a resposta demora ou a equipe não sabe conduzir a conversa, o problema continua existindo depois do clique.`,
  }),
  heading(11, "acao-principal", "Deixe a próxima ação evidente"),
  block(12, "cta-e-conversao", true, false, {
    type: "TEXT",
    body: `O CTA é o convite para a próxima ação.

Por exemplo:

“Solicitar orçamento”

“Agendar pelo WhatsApp”

“Comprar agora”

“Quero me matricular”

A conversão é o evento que indica que essa ação avançou de forma relevante.

Por exemplo:

CTA:
“Solicitar orçamento”

Conversão:
formulário enviado com sucesso.

CTA:
“Agendar pelo WhatsApp”

Conversão observável:
início da conversa.

Resultado de negócio:
agendamento efetivamente realizado.

Essa diferença será importante para a mensuração.`,
  }),
  block(13, "exemplo-whatsapp-conversao", true, false, {
    type: "EXAMPLE",
    title: "Um clique no WhatsApp não é necessariamente uma venda",
    body: `Imagine:

100 pessoas clicaram no botão de WhatsApp.

60 realmente iniciaram uma conversa.

25 tinham perfil para comprar.

12 pediram orçamento.

5 fecharam.

Qual número representa o resultado da campanha?

Depende da pergunta.

Para medir interação com a página:
100 cliques podem ser relevantes.

Para medir início de conversa:
60.

Para medir oportunidade qualificada:
25.

Para medir venda:
5.

Por isso, uma boa estrutura separa os diferentes momentos do funil.`,
  }),
  block(14, "checkpoint-clique-vs-resultado", true, true, {
    type: "CHECKPOINT",
    question: "Uma campanha registrou 40 cliques no botão de WhatsApp. Podemos afirmar que ela gerou 40 clientes?",
    options: [
      { id: "sim", label: "Sim." },
      { id: "sim-se-pago", label: "Sim, desde que o anúncio seja pago." },
      { id: "clique-nao-e-cliente", label: "Não. O clique é uma ação mensurável, mas ainda precisamos saber o que aconteceu depois." },
      { id: "apenas-meta", label: "Apenas se a campanha estiver no Meta Ads." },
    ],
    correctOptionId: "clique-nao-e-cliente",
    explanation:
      "O clique mostra intenção de avançar, mas não prova que houve conversa qualificada, agendamento ou venda. É importante acompanhar também o resultado posterior.",
  }),
  heading(15, "mensurar-nao-e-so-instalar-tag", "Mensurar não é apenas instalar uma tag"),
  block(16, "mensuracao-responde-perguntas", true, false, {
    type: "TEXT",
    body: `Ferramentas de mensuração existem para responder perguntas.

Antes de escolher a ferramenta, descubra quais perguntas você precisa responder.

Por exemplo:

“Quantas pessoas chegaram pelo anúncio?”

“Quantas enviaram o formulário?”

“Quantas iniciaram uma conversa?”

“Quantas viraram oportunidades reais?”

“Quantas compraram?”

Google Ads, Meta Ads, Google Analytics, pixels, tags, parâmetros de URL, CRM e planilhas podem participar desse processo.

Mas instalar ferramentas sem saber o que pretende medir pode gerar muitos números e pouca clareza.`,
  }),
  block(17, "tres-camadas-mensuracao", true, false, {
    type: "TEXT",
    body: `Uma estrutura simples pode ser pensada em três camadas.

1. Origem

Como você identifica de onde aquela visita ou contato veio?

Dependendo da estrutura, podem participar:

- informações da própria plataforma;
- parâmetros UTM;
- identificação automática;
- registros do sistema;
- pergunta no atendimento.

2. Conversão

Como você identifica que a ação principal aconteceu?

Por exemplo:

- formulário enviado;
- compra concluída;
- conversa iniciada;
- agendamento realizado.

3. Resultado de negócio

O que aconteceu depois?

O lead:

- era qualificado?
- recebeu orçamento?
- agendou?
- comprou?
- voltou?
- foi perdido?

Essa terceira camada é frequentemente esquecida.

E é justamente ela que aproxima as métricas de marketing da realidade financeira do negócio.`,
  }),
  block(18, "metricas-nao-substituem-negocio", true, false, {
    type: "CALLOUT",
    tone: "info",
    title: "A plataforma não conhece toda a sua empresa",
    body: `Uma plataforma de anúncios pode saber que uma conversão foi registrada.

Ela não necessariamente sabe se aquele contato foi bem atendido, se o cliente tinha perfil, se o orçamento foi aceito ou se a venda foi concluída.

Por isso, dados da plataforma e dados do negócio precisam conversar.`,
  }),
  block(19, "exemplo-cadeia-mensuracao", true, false, {
    type: "EXAMPLE",
    title: "Do anúncio até a venda",
    body: `Imagine uma campanha para pedidos de orçamento.

O caminho pode ser:

1. Pessoa vê o anúncio.
2. Clica.
3. Visita a landing page.
4. Envia o formulário.
5. O contato entra no atendimento.
6. A empresa qualifica o lead.
7. Envia o orçamento.
8. O cliente compra.

A plataforma pode medir muito bem as primeiras etapas.

Mas, se a empresa não registra as últimas, pode saber quanto custa um formulário e ainda não saber quanto custa uma venda.`,
  }),
  block(20, "checkpoint-tres-camadas", true, true, {
    type: "CHECKPOINT",
    question: "Uma empresa mede os formulários enviados, mas não registra quais leads viraram clientes. O que está faltando principalmente?",
    options: [
      { id: "falta-origem", label: "A primeira camada, origem." },
      { id: "falta-resultado-de-negocio", label: "A conexão entre a conversão de marketing e o resultado de negócio." },
      { id: "novo-dominio", label: "Um novo domínio." },
      { id: "mais-anuncios", label: "Mais anúncios." },
    ],
    correctOptionId: "falta-resultado-de-negocio",
    explanation:
      "Medir formulários é útil, mas ainda é necessário acompanhar o que acontece com essas oportunidades para relacionar mídia paga ao resultado comercial.",
  }),
  heading(21, "identifique-origem", "Identifique a origem sem depender da memória"),
  block(22, "utm-e-identificacao", true, false, {
    type: "TEXT",
    body: `Quando diferentes campanhas enviam pessoas ao mesmo site, identificar a origem ajuda a comparar resultados.

Um recurso comum são os parâmetros UTM.

Eles podem registrar informações como:

utm_source

origem do tráfego.

utm_medium

tipo de mídia.

utm_campaign

nome lógico da campanha.

Esses parâmetros não substituem o rastreamento nativo das plataformas e não são obrigatórios em todos os cenários.

Eles são uma forma de preservar contexto quando o tráfego passa por outras ferramentas de análise.

O mais importante é existir um padrão consistente.

Não crie nomes diferentes a cada dia para a mesma coisa.`,
  }),
  block(23, "nao-coloque-dados-pessoais-url", true, false, {
    type: "CALLOUT",
    tone: "info",
    title: "Não coloque dados pessoais em parâmetros de campanha",
    body: `Não use nome, telefone, e-mail ou outros dados pessoais do cliente em UTM ou parâmetros de URL.

Parâmetros de campanha devem identificar a origem da mídia e a campanha, não a identidade da pessoa.`,
  }),
  heading(24, "teste-antes-publicar", "Teste o caminho antes de pagar por ele"),
  block(25, "teste-ponta-a-ponta", true, false, {
    type: "TEXT",
    body: `Antes de colocar dinheiro na campanha, faça o caminho como se fosse um cliente.

No celular:

1. Abra o destino.
2. Confirme se a oferta aparece.
3. Localize a principal ação.
4. Clique.
5. Preencha ou inicie o contato.
6. Confirme se a ação funciona.
7. Verifique se o resultado é registrado onde deveria.

Pode parecer básico.

Mas pequenos erros podem desperdiçar tráfego:

- botão com link errado;
- número antigo de WhatsApp;
- formulário sem envio;
- página que quebra no celular;
- evento de conversão que não dispara;
- conversão disparando duas vezes;
- página de obrigado acessível sem preencher o formulário.

Mensuração também precisa ser testada.`,
  }),
  block(26, "checklist-pre-lancamento-destino", false, false, {
    type: "CHECKLIST",
    items: [
      { id: "oferta-clara", label: "A oferta aparece de forma clara no destino." },
      { id: "acao-facil", label: "A principal ação é fácil de encontrar." },
      { id: "conferi-no-celular", label: "Conferi o destino no celular." },
      { id: "caminho-completo", label: "Testei o caminho completo da ação." },
      { id: "evento-da-conversao", label: "Sei qual evento representa a conversão principal." },
      { id: "resultado-comercial", label: "Sei onde acompanharei o resultado comercial depois do lead." },
    ],
  }),
  heading(27, "monte-plano-destino", "Monte seu Plano de Destino e Mensuração"),
  block(28, "plano-destino-mensuracao", true, true, {
    type: "TOOL",
    toolKey: "DESTINATION_MEASUREMENT_PLAN_V1",
    title: "Plano de Destino e Mensuração",
    description: `Agora aplique a aula ao projeto escolhido.

Você definirá:

- destino;
- CTA;
- conversão principal;
- verificações do destino;
- identificação da origem;
- rastreamento da conversão;
- registro do resultado comercial;
- pendências antes do lançamento.

Se existir um Brief Inicial de Campanha para este projeto, parte das informações será reutilizada.`,
  }),
  heading(29, "como-interpretar-plano", "Se aparecer uma pendência, isso é útil"),
  block(30, "pendencias-antes-lancamento", true, false, {
    type: "TEXT",
    body: `O objetivo do plano não é entregar um selo de perfeição.

É evitar que você descubra problemas básicos depois de começar a pagar pelos cliques.

Se o resultado indicar uma pendência, resolva primeiro aquilo que realmente impede a leitura dos resultados.

Por exemplo:

“Não testei o formulário.”

Isso deveria ser corrigido antes do lançamento.

“Não tenho Google Analytics.”

Isso pode merecer atenção, mas não significa automaticamente que toda campanha seja impossível.

O contexto importa.

O ponto central é:

você precisa conseguir acompanhar a ação que definiu como conversão e, sempre que possível, relacioná-la ao resultado real do negócio.`,
  }),
  block(31, "checkpoint-final-mensuracao", true, true, {
    type: "CHECKPOINT",
    question: "Qual cenário representa a estrutura mais útil para avaliar uma campanha?",
    options: [
      { id: "so-visualizacoes", label: "Saber apenas quantas pessoas visualizaram o anúncio." },
      { id: "so-cliques", label: "Saber apenas quantos cliques foram comprados." },
      { id: "origem-conversao-negocio", label: "Conseguir relacionar origem, conversão e o que aconteceu comercialmente com as oportunidades." },
      { id: "mais-ferramentas", label: "Instalar o maior número possível de ferramentas de analytics." },
    ],
    correctOptionId: "origem-conversao-negocio",
    explanation:
      "A mensuração ganha valor quando conecta o investimento à ação gerada e ao resultado posterior do negócio. Mais ferramentas não significam automaticamente mais clareza.",
  }),
  block(32, "conclusao-aula-05", true, false, {
    type: "CONCLUSION",
    body: `Agora o clique tem um caminho

Nas duas aulas deste módulo você construiu a base da sua campanha antes de entrar na plataforma.

Primeiro, definiu:

- oferta;
- objetivo;
- conversão;
- orçamento;
- primeira revisão.

Agora preparou:

- destino;
- CTA;
- caminho da conversão;
- identificação da origem;
- forma de acompanhar o resultado.

Isso muda a forma de criar uma campanha.

Você deixa de pensar apenas:

“Como faço um anúncio?”

e passa a pensar:

“Como vou transformar esse tráfego em uma ação que consigo acompanhar?”

A partir daqui, o caminho técnico depende do canal mais adequado ao seu negócio.

Se o Google Ads fizer sentido para seu projeto, o próximo conteúdo recomendado é:

“Estruture uma campanha de Pesquisa.”

Se Meta Ads fizer mais sentido, você pode seguir diretamente para o módulo de Meta Ads.

Os módulos são recomendados, não obrigatórios.`,
  }),
];
