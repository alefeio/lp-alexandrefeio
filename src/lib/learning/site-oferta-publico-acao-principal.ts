import type { LessonBlockData } from "@/lib/learning/blocks";
import { CONVERSION_PAGE_BRIEF_TOOL, SITE_OFFER_BRIEF_SLUG } from "@/lib/learning/conversion-page-brief";

export const SITE_LESSON_04_SLUG = SITE_OFFER_BRIEF_SLUG;

export const siteLesson04Meta = {
  title: "Defina oferta, público e ação principal",
  summary: "Defina a estratégia da landing page e abra o projeto real que vai até a publicação.",
  publicPreview:
    "A landing page começa pela oferta, pelo público e pela ação — não pelo layout. Nesta aula você registra essas decisões no projeto da sua página.",
  estimatedMinutes: 30,
  accessType: "PAID" as const,
  priceCents: 3490,
  commerceStatus: "NOT_FOR_SALE" as const,
};

export type SiteLesson04Block = {
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
): SiteLesson04Block {
  return { position, blockKey, countsForProgress, required, data };
}

const heading = (position: number, blockKey: string, text: string) =>
  block(position, blockKey, false, false, { type: "HEADING", level: 2, text });

export const siteLesson04Blocks: SiteLesson04Block[] = [
  heading(1, "pagina-nasce-da-estrategia", "A página nasce da estratégia"),
  block(2, "abertura-layout", true, false, {
    type: "TEXT",
    body: `Se você começar escolhendo layout antes de saber o que quer comunicar, vai acabar tentando encaixar o negócio dentro de um template.

As aulas anteriores mostraram o caminho, a estrutura digital e os fundamentos que pedem atenção. Agora começa a construção.

Esta aula transforma “eu sei que preciso de uma landing page” em uma estratégia definida: oferta, público, objetivo e ação.`,
  }),
  block(3, "callout-nao-comeca-pela-cor", true, false, {
    type: "CALLOUT",
    tone: "info",
    title: "Não comece pela cor",
    body: `Uma página não começa pela cor, pelo template, pela headline nem pela tecnologia.

Ela começa respondendo: o que estamos oferecendo, para quem, por que isso importa e o que queremos que a pessoa faça.`,
  }),
  heading(4, "uma-oferta-principal", "Uma página, uma oferta principal"),
  block(5, "foco-nao-item-unico", true, false, {
    type: "TEXT",
    body: `Uma landing page pode mencionar serviços relacionados, benefícios, opções e planos.

O que não pode faltar é uma oferta principal compreensível. A questão é clareza de foco — não a regra de “só vender um único item”.

“Consulta contábil para regularização de pequenos negócios” é mais útil do que “serviços contábeis”.`,
  }),
  heading(6, "o-que-e-oferta", "O que entra na oferta"),
  block(7, "oferta-nao-e-so-preco", true, false, {
    type: "TEXT",
    body: `Oferta não é só produto mais preço. Envolve o que está sendo oferecido, para quem, que problema ou contexto atende, o benefício e a forma de avançar.

Público, aqui, não é uma persona inventada. Não precisamos de nome fictício, idade ou hobby. Precisamos saber quem precisa disso, em que situação, o que já sabe e o que está tentando resolver.`,
  }),
  block(8, "exemplo-moveis", true, false, {
    type: "EXAMPLE",
    title: "Móveis planejados",
    body: `Oferta: projeto de cozinha planejada para apartamentos.
Público: quem vai reformar a cozinha e precisa de um desenho antes de comprar.
Objetivo da página: receber pedidos de visita para medir o espaço.
Ação: solicitar uma visita.`,
  }),
  heading(9, "problema-e-beneficio", "Problema, contexto e benefício"),
  block(10, "problema-nao-e-dor-dramatica", true, false, {
    type: "TEXT",
    body: `Nem toda oferta resolve uma dor dramática. Pode existir necessidade, objetivo, desejo, situação ou oportunidade. Evite linguagem que invente medo.

Benefício não é característica. “Atendimento pelo WhatsApp” é um canal. “Tirar dúvidas antes de contratar” só é benefício se for verdadeiro para o seu trabalho. Não invente um benefício que você não entrega.`,
  }),
  block(11, "exemplo-servico", true, false, {
    type: "EXAMPLE",
    title: "Profissional de serviço",
    body: `Oferta: gestão de Google Ads para pequenos negócios que querem gerar contatos.
Público: negócios que já têm uma oferta e precisam atrair potenciais clientes.
Objetivo da página: gerar pedidos de contato para avaliar a gestão.
Ação: solicitar análise.`,
  }),
  heading(12, "objetivo-e-acao", "Objetivo da página e ação principal"),
  block(13, "objetivo-nao-e-o-negocio", true, false, {
    type: "TEXT",
    body: `O negócio pode querer aumentar vendas. A página pode ter um objetivo menor e concreto: gerar pedidos de orçamento.

A ação principal é o próximo passo visível: WhatsApp, formulário, orçamento, agendamento, compra, cadastro ou um link. A ação secundária é opcional — por exemplo, ver portfólio — e não deve competir com a principal.

Se a pessoa realizar a ação, isso pode significar um lead, um orçamento, um horário, uma venda, um cadastro ou uma conversa. Um clique ainda não é uma venda.`,
  }),
  heading(14, "objecoes-e-chegada", "Objeções e contexto de chegada"),
  block(15, "aluno-informa-objecoes", true, false, {
    type: "TEXT",
    body: `Pergunte: o que pode fazer alguém interessado hesitar antes de agir? Preço, confiança, prazo, funcionamento, experiência, localização, comparação ou risco percebido. Você informa. A aula não cria objeções sozinha.

Também registre de onde a pessoa provavelmente chega e o que ela já sabe. Isso usa o mapa da primeira aula e prepara a jornada da próxima, sem escrever a copy agora.`,
  }),
  block(16, "callout-nao-e-copy", true, false, {
    type: "CALLOUT",
    tone: "warning",
    title: "Ainda não é hora da headline",
    body: `Esta aula não pede headline final, parágrafos finais, FAQ final nem texto final do botão.

Estamos definindo fatos e decisões. A mensagem da página vem depois.`,
  }),
  block(17, "exemplo-clareza", true, false, {
    type: "EXAMPLE",
    title: "Do genérico ao específico",
    body: `Pouco claro: oferta “marketing digital”, público “empresas”, objetivo “vender mais”.

Mais claro: oferta “gestão de Google Ads para pequenos negócios que querem gerar contatos”, público “pequenos negócios que já possuem uma oferta”, objetivo “gerar pedidos de contato para avaliar a gestão”, ação “solicitar análise”.`,
  }),
  block(18, "exemplo-produto-digital", true, false, {
    type: "EXAMPLE",
    title: "Produto ou curso digital",
    body: `Oferta: aula gravada para organizar o cardápio de um delivery.
Público: quem já vende pelo WhatsApp e perde pedidos por mensagem confusa.
Objetivo da página: inscrever interessados na turma.
Ação: quero receber o aviso de inscrição.`,
  }),
  block(19, "checkpoint-persona", true, true, {
    type: "CHECKPOINT",
    question: "Definir público significa inventar uma persona detalhada?",
    options: [
      { id: "sim", label: "Sim — nome, idade e hobbies são obrigatórios" },
      { id: "nao", label: "Não — basta o que ajuda a página a ser clara" },
    ],
    correctOptionId: "nao",
    explanation: "A página precisa saber quem está na situação de decidir. Não precisa de uma biografia inventada.",
  }),
  block(20, "checkpoint-objetivo", true, true, {
    type: "CHECKPOINT",
    question: "O objetivo da página e o objetivo geral do negócio são sempre a mesma coisa?",
    options: [
      { id: "sim", label: "Sim — se o negócio quer vender, a página também precisa vender na hora" },
      { id: "nao", label: "Não — a página pode ter um próximo passo menor e concreto" },
    ],
    correctOptionId: "nao",
    explanation: "Aumentar vendas pode ser o objetivo do negócio. A página pode existir para gerar um pedido de orçamento.",
  }),
  block(21, "checkpoint-secundaria", true, true, {
    type: "CHECKPOINT",
    question: "Uma landing page pode ter ação secundária?",
    options: [
      { id: "sim", label: "Sim, desde que não prejudique a hierarquia da ação principal" },
      { id: "nao", label: "Não — qualquer segundo botão invalida a página" },
    ],
    correctOptionId: "sim",
    explanation: "Ver um portfólio pode ajudar. O problema é criar duas ações com o mesmo peso, sem saber qual é a principal.",
  }),
  block(22, "checkpoint-headline", true, true, {
    type: "CHECKPOINT",
    question: "A headline final deve ser escrita antes de definir a oferta?",
    options: [
      { id: "sim", label: "Sim — o texto vem antes da estratégia" },
      { id: "nao", label: "Não — a oferta e a ação vêm antes da copy" },
    ],
    correctOptionId: "nao",
    explanation: "Sem oferta, público e ação, a headline vira frase solta. A copy vem numa etapa seguinte.",
  }),
  block(23, "atividade-estrategia", true, true, {
    type: "ACTIVITY",
    inputType: "long_text",
    prompt: "Antes da ferramenta, escreva em uma frase: o que você oferece, para quem, qual é o objetivo desta página e qual é a ação principal. Ainda não escreva a headline.",
  }),
  block(24, "ferramenta-brief", true, true, {
    type: "TOOL",
    toolKey: CONVERSION_PAGE_BRIEF_TOOL,
    title: "Brief de conversão da minha landing page",
    description: "Crie ou escolha o projeto da landing page e registre oferta, público, objetivo, ação, objeções e contexto de chegada.",
  }),
  block(25, "resultado-brief", false, true, {
    type: "RESULT",
    title: "Brief de conversão da minha landing page",
    prompt: "O resumo desta etapa fica no resultado da aula. A estratégia completa fica no projeto da landing page.",
    fields: [
      { key: "oferta", label: "Oferta" },
      { key: "publico", label: "Público" },
      { key: "acao", label: "Ação principal" },
    ],
  }),
  block(26, "conclusao-projeto-real", true, false, {
    type: "CONCLUSION",
    body: `Agora sua landing page deixou de ser apenas uma ideia. Ela já possui uma oferta, um público, um objetivo e uma ação definidos.

O projeto real foi criado. Ele segue com você até a publicação. As seções da página ainda não foram geradas: a próxima aula olha o que a pessoa precisa perceber, compreender e acreditar antes de agir.`,
  }),
  block(27, "proxima-jornada", true, false, {
    type: "TEXT",
    body: `Próxima aula: Planeje a jornada do visitante.

Na próxima etapa, vamos entender o que a pessoa precisa perceber, compreender e acreditar antes de realizar essa ação. Wireframe, copy, design, provas, celular e mensuração vêm depois.`,
  }),
  heading(28, "o-que-voce-leva", "O que você leva desta aula"),
  block(29, "leva-projeto", true, false, {
    type: "TEXT",
    body: `Você leva um projeto de landing page em rascunho, com a estratégia salva nele.

O endereço futuro pode aparecer como alexandrefeio.com.br/p/sua-oferta. Esse endereço só fica público quando você publicar a página ao final da formação.`,
  }),
  block(30, "callout-mesmo-projeto", true, false, {
    type: "CALLOUT",
    tone: "tip",
    title: "Um projeto até o fim",
    body: `Oferta, público, problema, benefício, objetivo, ações, resultado esperado, objeções e origem ficam no mesmo projeto que as próximas aulas vão completar.`,
  }),
  block(31, "revisao-antes-de-salvar", true, false, {
    type: "TEXT",
    body: `Na ferramenta, confira o resumo antes de salvar: sua oferta, seu público, o objetivo da página, a ação principal, o resultado esperado e as principais objeções.

Você pode voltar e editar. Salvar de novo atualiza o mesmo projeto, sem criar uma segunda estratégia paralela.`,
  }),
];
