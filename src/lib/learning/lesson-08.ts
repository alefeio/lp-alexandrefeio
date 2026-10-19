import type { LessonBlockData } from "@/lib/learning/blocks";

export const LESSON_08_SLUG = "anuncios-alinhados-a-conversao";

export const lesson08Meta = {
  title: "Crie anúncios alinhados à conversão",
  summary:
    "Escreva anúncios responsivos em que a busca, a oferta, a página e o próximo passo dizem a mesma coisa.",
  publicPreview:
    "O anúncio de pesquisa liga a busca à página. Esta aula mostra como um anúncio responsivo combina títulos e descrições sem prometer o que o destino não entrega.",
  estimatedMinutes: 35,
  accessType: "PAID" as const,
  priceCents: 3490,
  commerceStatus: "NOT_FOR_SALE" as const,
};

export type Lesson08Block = {
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
): Lesson08Block {
  return { position, blockKey, countsForProgress, required, data };
}

const heading = (position: number, blockKey: string, text: string) =>
  block(position, blockKey, false, false, { type: "HEADING", level: 2, text });

export const lesson08Blocks: Lesson08Block[] = [
  heading(1, "busca-anuncio-pagina", "Da busca ao próximo passo"),
  block(2, "cadeia-da-conversao", true, false, {
    type: "TEXT",
    body: `A campanha já tem estrutura. As buscas que você quer disputar também.

Agora a pergunta é outra.

O anúncio deixa claro, para a pessoa certa, o que você oferece, por que vale clicar e qual é o próximo passo?

A cadeia é curta:

busca → anúncio → destino → conversão.

Se um elo mente sobre o outro, o clique fica caro. A pessoa pesquisou uma coisa, leu outra e caiu numa página que pede uma terceira.`,
  }),
  block(3, "anuncio-nao-existe-sozinho", true, false, {
    type: "CALLOUT",
    tone: "info",
    title: "O anúncio não vive sozinho",
    body: `A promessa precisa caber na intenção da busca, na oferta, na página e na ação que você definiu como conversão.

Texto bonito, com destino confuso, ainda não está pronto para configurar.`,
  }),
  heading(4, "o-que-e-rsa", "O anúncio responsivo de pesquisa"),
  block(5, "combinacoes-do-rsa", true, false, {
    type: "TEXT",
    body: `No Google Ads, o formato atual de anúncio de pesquisa é o anúncio responsivo, ou RSA.

Você entrega vários títulos e várias descrições. A plataforma monta combinações diferentes. Em uma exibição podem aparecer até três títulos e até duas descrições, não a lista inteira de uma vez.

Por isso cada peça precisa fazer sentido sozinha.

“Aprenda” num título e “Google Ads” no seguinte só funcionam quando saem juntos. Separados, um deles não diz nada.

Os limites deste formato, na documentação atual do Google Ads, são: 3 a 15 títulos de até 30 caracteres, 2 a 4 descrições de até 90, e dois caminhos de exibição de até 15 cada. Em coreano, japonês e chinês, cada caractere conta como dois. Mais títulos não são, por si, um anúncio melhor.`,
  }),
  block(6, "exemplo-curso-curto", true, false, {
    type: "EXAMPLE",
    title: "Três peças que sobrevivem separadas",
    body: `Grupo: curso de tráfego pago.

Títulos que ainda significam alguma coisa se aparecerem sem os outros:

- Curso de Tráfego Pago
- Aprenda Google Ads na Prática
- Comece com Aulas Gratuitas

Cada um diz a oferta, o método ou a ação. Nenhum depende da frase ao lado para existir.`,
  }),
  block(7, "checkpoint-combinacao", true, true, {
    type: "CHECKPOINT",
    question: "Por que um título do anúncio responsivo precisa funcionar sozinho?",
    options: [
      { id: "sempre-juntos", label: "Porque a plataforma sempre mostra os títulos na ordem em que você escreveu." },
      { id: "combinacoes", label: "Porque títulos e descrições entram em combinações diferentes, e uma peça pode aparecer sem a outra." },
      { id: "excelente", label: "Porque só assim o Ad Strength fica Excelente." },
    ],
    correctOptionId: "combinacoes",
    explanation: "O RSA testa combinações. Uma frase partida em dois títulos pode aparecer incompleta.",
  }),
  heading(8, "cinco-componentes", "Cinco perguntas antes de escrever"),
  block(9, "categorias-de-titulo", true, false, {
    type: "TEXT",
    body: `Um anúncio útil costuma responder cinco coisas, sem precisar ocupar as cinco em todo título:

1. A busca encontra o que a pessoa pediu.
2. A oferta aparece com o nome que ela reconheceria.
3. Há um benefício ou diferencial verdadeiro.
4. Há prova só quando ela existe.
5. A ação é a conversão que você já definiu.

As categorias da ferramenta — intenção, oferta, benefício, diferencial, ação, marca, local e prova — são um jeito de pensar. O Google Ads não exige uma categoria por posição.

Exemplo de ângulos, não de fórmula:

- Curso de Tráfego Pago
- Aprenda Google Ads na Prática
- Estruture Sua Primeira Campanha
- Aplique no Seu Próprio Negócio
- Comece com Aulas Gratuitas
- Alexandre Feio

Repetir a palavra-chave em todos os títulos não cria variedade. “Curso de Google Ads”, “Google Ads Curso” e “Curso Google Ads” são o mesmo anúncio escrito três vezes.`,
  }),
  block(10, "exemplo-advogado-local", true, false, {
    type: "EXAMPLE",
    title: "Advogado trabalhista",
    body: `Grupo com buscas como advogado trabalhista, advogado para rescisão e advogado trabalhista em Belém.

O anúncio pode dizer o serviço, a cidade, o problema e o contato.

Pode usar experiência quando ela for real e verificável.

Não cabe aqui “melhor advogado”, “100% de sucesso” ou “causa ganha”. Isso não é diferencial. É afirmação que a página e o caso não sustentam.`,
  }),
  block(11, "checkpoint-promessa", true, true, {
    type: "CHECKPOINT",
    question: "Qual título combina com um grupo de advogado trabalhista em Belém?",
    options: [
      { id: "causa-ganha", label: "Causa ganha em Belém." },
      { id: "consulta", label: "Advogado trabalhista em Belém." },
      { id: "keyword-repetida", label: "Trabalhista advogado trabalhista Belém." },
    ],
    correctOptionId: "consulta",
    explanation: "O título diz o serviço e o lugar. Não inventa resultado e não repete a busca só para preenchê-la.",
  }),
  heading(12, "titulos-com-angulo", "Variedade é mudança de ângulo"),
  block(13, "variedade-real", true, false, {
    type: "TEXT",
    body: `Troque o ângulo, não a ordem das palavras.

Oferta, benefício, problema, público, ação, marca, localização e diferencial são caminhos diferentes.

Uma versão inicial pode ficar pronta com poucos títulos, desde que cada um diga algo distinto e caiba no limite. Chegar a 15 não é a meta.

O caminho de exibição, como curso/google-ads, não precisa ser uma pasta real do site. Ele precisa representar o destino sem enganar.`,
  }),
  block(14, "nao-repita-a-keyword", true, false, {
    type: "CALLOUT",
    tone: "tip",
    title: "A busca não precisa estar em todos os títulos",
    body: `Um título pode ecoar a pesquisa. Os outros podem dizer a oferta, o próximo passo ou o que muda para essa pessoa.

Fixar o primeiro título em toda combinação também não é o padrão. Fixar é exceção.`,
  }),
  heading(15, "descricoes-complementam", "A descrição continua o título"),
  block(16, "descricao-nao-repete", true, false, {
    type: "TEXT",
    body: `A descrição não é o título escrito de novo.

Ela pode explicar o benefício, como o serviço funciona, o contexto ou a ação. Prova entra quando você tem um fato, não um adjetivo.

“Curso de tráfego pago para quem vai aplicar no próprio negócio. As aulas mostram campanha, palavras-chave e anúncio antes de abrir a plataforma.”

Isso acrescenta. “Curso de tráfego pago. Curso Google Ads. Aprenda tráfego pago.” não acrescenta.`,
  }),
  block(17, "cta-da-conversao", true, false, {
    type: "TEXT",
    body: `O chamado precisa ser a conversão que a campanha mede.

Comprar, solicitar orçamento, agendar avaliação, falar no WhatsApp, começar gratuitamente ou fazer o diagnóstico são ações diferentes.

“Saiba mais” é um resto. Use só quando a conversão for, de fato, essa leitura. Se o destino pede um formulário, um horário ou uma conversa, o anúncio deve nomear isso.

Urgência falsa e promoção que não existe na página ficam de fora. Copiar o texto do concorrente também.`,
  }),
  block(18, "checkpoint-cta", true, true, {
    type: "CHECKPOINT",
    question: "A conversão da campanha é uma mensagem no WhatsApp. Qual chamado combina?",
    options: [
      { id: "saiba-mais", label: "Saiba mais." },
      { id: "whatsapp", label: "Falar no WhatsApp." },
      { id: "compre-ja", label: "Compre agora com desconto." },
    ],
    correctOptionId: "whatsapp",
    explanation: "O anúncio pede a mesma ação que a campanha vai contar. Desconto que não existe e “saiba mais” desviam essa ação.",
  }),
  heading(19, "destino-precisa-cumprir", "Depois do clique, a promessa ainda está lá?"),
  block(20, "pagina-e-anuncio", true, false, {
    type: "TEXT",
    body: `Use o destino que você já definiu. A URL final do anúncio aponta para ele.

A pergunta prática é uma só: o que o anúncio promete está visível nessa página?

Se o anúncio fala em orçamento e a página só mostra um texto institucional, registre a pendência. O texto do anúncio pode estar claro e, mesmo assim, a campanha não está pronta.

A aprovação desta aula não é a aprovação do Google Ads. A ferramenta organiza o plano. Ela não cria campanha nem publica anúncio.`,
  }),
  heading(21, "pinning-e-excecao", "Fixar é uma decisão, não um padrão"),
  block(22, "fixar-reduz-combinacao", true, false, {
    type: "CALLOUT",
    tone: "warning",
    title: "Fixar reduz as combinações possíveis",
    body: `Dá para prender um título na posição 1, 2 ou 3, e uma descrição na posição 1 ou 2.

Isso serve quando uma mensagem precisa aparecer sempre: exigência legal, marca numa posição combinada, condição comercial que não pode sumir, ou um teste que pede controle.

Não fixe tudo para “garantir” a frase. Você só diminui o que o formato consegue testar.`,
  }),
  block(23, "ad-strength-nao-e-meta", true, false, {
    type: "CALLOUT",
    tone: "info",
    title: "Ad Strength não é o objetivo",
    body: `O Ad Strength é um retorno da plataforma. Ele pode apontar pouca variedade, pouca relação com a busca, texto repetido ou cobertura fina.

Não reescreva o anúncio só para aparecer como Excelente.

A conversão que você definiu continua sendo o critério. Um aviso da interface não substitui a página, a oferta nem o contato real.`,
  }),
  heading(24, "politicas-basicas", "O que o anúncio não pode inventar"),
  block(25, "afirmacao-verificavel", true, false, {
    type: "TEXT",
    body: `Não faça afirmação enganosa. Não invente promoção, preço, prova ou resultado garantido.

Se o valor não está na oferta, ele não entra no título. Se você não tem o número, não escreva o número.

Esta aula não cobre todas as políticas do Google Ads. Ela marca o mínimo para o plano não nascer mentindo.

Quando a ferramenta disser que o plano pode ser configurado, isso ainda não significa que o Google vá aprovar o anúncio.`,
  }),
  block(26, "exemplo-falsa-variedade", true, false, {
    type: "EXAMPLE",
    title: "Isto não é variedade",
    body: `Curso de Google Ads
Google Ads Curso
Curso Google Ads
Google Ads Para Curso

Os quatro ocupam espaço e dizem uma coisa só.

Ângulos diferentes, no mesmo grupo de curso:

Curso de Tráfego Pago
Aprenda Google Ads na Prática
Aplique no Seu Negócio
Comece com Aulas Gratuitas
Diagnóstico e Ferramentas

A página e o botão precisam mostrar esse curso, essa aplicação e esse começo. Se o clique cai numa página genérica, o anúncio prometeu demais.`,
  }),
  block(27, "atividade-promessa-do-anuncio", true, true, {
    type: "ACTIVITY",
    prompt: "Escreva a promessa principal de um anúncio seu e diga se ela aparece, com a mesma ação, na página de destino.",
    inputType: "long_text",
    placeholder: "A promessa e o que a página mostra depois do clique",
  }),
  block(28, "checklist-antes-do-anuncio", true, true, {
    type: "CHECKLIST",
    items: [
      { id: "busca-oferta", label: "O anúncio fala com a busca e com a oferta deste grupo." },
      { id: "pecas-sozinhas", label: "Cada título ainda faz sentido se aparecer sem os outros." },
      { id: "cta-conversao", label: "O chamado é a conversão da campanha, não um “saiba mais” automático." },
      { id: "destino-visivel", label: "O destino mostra a promessa, sem preço ou prova inventados." },
    ],
  }),
  heading(29, "plano-de-anuncios", "Monte o anúncio de cada grupo"),
  block(30, "plano-anuncios-responsivos", true, true, {
    type: "TOOL",
    toolKey: "RESPONSIVE_SEARCH_AD_PLAN_V1",
    title: "Plano de anúncios responsivos",
    description: `Escreva, por grupo, a URL final, os caminhos, os títulos e as descrições.

Se a campanha e a lista de palavras já existirem neste projeto, nome, oferta, conversão, destino e buscas marcadas para usar entram preenchidos.

Buscas excluídas não viram anúncio. Negativas aparecem só como contexto.

Sem a lista da aula anterior, dá para seguir com o mínimo: grupo, tema, buscas, oferta, conversão e destino. A aula de palavras-chave continua recomendada.

A ferramenta não publica nada no Google Ads.`,
  }),
  block(31, "checkpoint-anuncio-pronto", true, true, {
    type: "CHECKPOINT",
    question: "Quando o plano do anúncio pode ir para a configuração?",
    options: [
      { id: "quinze-titulos", label: "Quando os 15 títulos estiverem preenchidos e o Ad Strength puder ficar alto." },
      { id: "cadeia", label: "Quando os limites cabem, a oferta aparece, o destino sustenta a promessa e o chamado é a conversão." },
      { id: "copiar", label: "Quando o texto ficou parecido com o do primeiro anúncio da pesquisa." },
    ],
    correctOptionId: "cadeia",
    explanation: "Quantidade máxima e nota da plataforma não decidem. A cadeia busca, anúncio, destino e conversão decide.",
  }),
  block(32, "conclusao-anuncio-alinhado", true, false, {
    type: "CONCLUSION",
    body: "O anúncio deixa claro para a pessoa certa o que você oferece, por que vale clicar e qual é o próximo passo. Se a página não sustenta essa frase, o texto ainda não está pronto.",
  }),
  block(33, "depois-de-configurar", true, false, {
    type: "TEXT",
    body: `Configurar é o passo seguinte, fora desta aula.

Quando o anúncio estiver no ar, os termos de pesquisa mostram se a combinação atraiu a busca que você escolheu. Aí se ajusta título, negativa ou página.

Não ajuste só porque uma nota da interface mudou de nome.`,
  }),
  block(34, "aviso-modulo-google", true, false, {
    type: "CALLOUT",
    tone: "info",
    title: "O plano para aqui",
    body: `Campanha, palavras-chave e anúncio fecham a sequência deste módulo.

A venda da Aula 7, desta aula e do módulo continua fechada até uma liberação própria. Este plano não cria a campanha no Google Ads.`,
  }),
];
