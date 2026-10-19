import type { LessonBlockData } from "@/lib/learning/blocks";

export const LESSON_10_SLUG = "campanhas-leads-whatsapp";
export const LESSON_11_SLUG = "leia-os-numeros";

export const lesson10Meta = {
  title: "Crie campanhas para leads e WhatsApp",
  summary:
    "Transforme o anúncio em um contato útil, defina quem atende e saiba qual estágio do resultado o negócio consegue registrar.",
  publicPreview:
    "Um lead não é uma venda. A campanha só faz sentido quando o anúncio, o contato, o atendimento e o registro do resultado estão no mesmo plano.",
  estimatedMinutes: 40,
  accessType: "PAID" as const,
  priceCents: 3990,
  commerceStatus: "NOT_FOR_SALE" as const,
};

export type Lesson10Block = {
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
): Lesson10Block {
  return { position, blockKey, countsForProgress, required, data };
}

const heading = (position: number, blockKey: string, text: string) =>
  block(position, blockKey, false, false, { type: "HEADING", level: 2, text });

export const lesson10Blocks: Lesson10Block[] = [
  heading(1, "lead-nao-e-venda", "Lead não é venda"),
  block(2, "contato-nao-e-venda", true, false, {
    type: "TEXT",
    body: `Lead é uma pessoa que fez a ação que o negócio definiu e que pode ter potencial comercial. Essa ação pode ser uma mensagem, um formulário ou um cadastro.

O contato pode ser qualificado, não qualificado, duplicado, sem resposta, fora da área atendida, sem orçamento ou um cliente real. Gerar mais leads não significa gerar mais receita.`,
  }),
  heading(3, "do-anuncio-ao-resultado", "Do anúncio ao resultado"),
  block(4, "tres-caminhos", true, false, {
    type: "TEXT",
    body: `A campanha não termina no clique, no “oi” ou no formulário enviado. A cadeia é anúncio, conversão inicial, contato, qualificação, atendimento, resultado comercial e mensuração.

Há três caminhos frequentes. WhatsApp ou outra mensagem reduz a fricção e permite qualificação humana, mas enche de conversa vazia quando a promessa é fraca e o atendimento demora. Formulário instantâneo estrutura as perguntas dentro da Meta e pede um processo de retorno. Site dá mais controle da experiência, desde que a página e a mensuração existam.

Nenhum dos três ganha sempre.`,
  }),
  block(5, "comparacao-dos-caminhos", false, false, {
    type: "EXAMPLE",
    title: "O mesmo pedido, três destinos",
    body: `Uma empresa de móveis planejados quer pedidos de orçamento.

No WhatsApp, a pessoa pede a avaliação do projeto e alguém pergunta cidade e ambiente. No formulário, essas perguntas já vêm estruturadas e o retorno acontece depois. No site, a página explica o serviço e o formulário só funciona se a visita for mensurada.

A escolha depende de como o negócio atende, não de um botão favorito.`,
  }),
  block(6, "qualidade-antes-do-volume", false, false, {
    type: "CALLOUT",
    tone: "info",
    title: "Defina o contato útil antes do volume",
    body: "Para móveis, um contato útil mora ou tem obra na região atendida, tem um ambiente em vista e quer orçamento. Para um curso digital, quer aprender o assunto, aceita o formato e reconhece o problema da oferta. Isso descreve o serviço. Não é critério para excluir pessoas por dado sensível.",
  }),
  heading(7, "whatsapp-nao-e-botao", "WhatsApp não é só um botão"),
  block(8, "conversa-precisa-de-plano", true, false, {
    type: "TEXT",
    body: `Campanha para conversa precisa de anúncio, mensagem inicial, poucas perguntas, responsável, horário, qualificação, retorno e registro do resultado.

“Fale conosco” não diz por que a pessoa deve começar a conversa. “Solicite uma avaliação do seu projeto de móveis planejados pelo WhatsApp” diz. Não invente urgência, desconto ou resposta imediata se a equipe não consegue cumprir.

A mensagem inicial deve trazer contexto. “Olá! Gostaria de solicitar um orçamento para móveis planejados.” é mais útil do que “Oi”. A Meta permite modelos de conversa, com saudação e perguntas sugeridas, e em alguns objetivos um formulário dentro do WhatsApp. Confirme o que a sua conta mostra.`,
  }),
  block(9, "promessa-do-anuncio", false, false, {
    type: "EXAMPLE",
    title: "Promessa que prepara a conversa",
    body: `Ruim: “Clique e fale conosco.”

Melhor: “Solicite uma avaliação do seu projeto de móveis planejados pelo WhatsApp.”

A primeira mensagem já pede o orçamento. As perguntas seguintes podem ser o serviço, a cidade ou o bairro, o momento e o que falta para calcular. Quatro perguntas chegam. Quinze viram interrogatório.`,
  }),
  block(10, "mensagem-inicial", true, false, {
    type: "TEXT",
    body: `Peça só o que ajuda a qualificar, atender ou priorizar. Não peça CPF, documento, dado de saúde ou informação financeira no primeiro contato.

O anúncio pode funcionar e o negócio perder a pessoa porque ninguém responde. Defina quem responde, em quais horários e o que acontece fora desse horário. Não existe um minuto universal. Quanto menor a demora razoável, menor o risco de a intenção esfriar.

Se vinte contatos chegarem amanhã e ninguém der conta, o orçamento está à frente da operação.`,
  }),
  block(11, "atendimento-e-capacidade", false, false, {
    type: "CALLOUT",
    tone: "warning",
    title: "Quem responde faz parte da campanha",
    body: "Se o diagnóstico de prontidão apontou operação como atenção, use isso como contexto. Não bloqueia a aula. Bloqueia, na prática, aumentar volume sem alguém para atender.",
  }),
  block(12, "requisitos-whatsapp", true, false, {
    type: "TEXT",
    body: `Para anunciar uma conversa no WhatsApp, a documentação atual pede uma conta WhatsApp Business, pelo aplicativo ou pela plataforma, ligada à Página do Facebook ou ao portfólio comercial. O número usado na campanha é o que estiver conectado.

Alguns recursos de mensagem não estão disponíveis para anúncios entregues na Europa, no Japão e na Coreia do Sul. Confirme a elegibilidade da conta antes de prometer o formato.

Não cole aqui o número, o token nem o identificador da conta. O plano registra a prontidão, não a credencial.`,
  }),
  heading(13, "formulario-nativo", "Formulário dentro da Meta"),
  block(14, "instant-form", true, false, {
    type: "TEXT",
    body: `O formulário instantâneo, na ajuda atual, existe quando o objetivo da campanha é Leads e o local da conversão é Instant forms. A pessoa preenche sem sair do anúncio.

Os tipos atuais incluem more volume, que é o padrão, higher intent e rich creative. Mais volume costuma reduzir a fricção. Maior intenção pede um passo a mais e pode diminuir a quantidade. Nenhum dos dois prova qualidade sozinho.

Nome, e-mail e telefone podem vir preenchidos se a pessoa já os informou à Meta. Não dependa disso. O formulário pede ao menos uma pergunta e, para rodar no Facebook ou Instagram, uma política de privacidade que diga o que será feito com o dado. Informe a finalidade. Isso não substitui a orientação jurídica do negócio.

Depois do envio, alguém precisa retornar. Formulário sem follow-up é lista parada.`,
  }),
  heading(15, "lead-pelo-site", "Lead pelo site"),
  block(16, "pagina-e-mensuracao", true, false, {
    type: "TEXT",
    body: `Se o caminho é o site, reutilize o destino já definido. A página precisa deixar clara a oferta, o próximo passo e o formulário ou a conversa. Esta aula não reconstrói a landing page.

Não trate o Pixel, o GA4 ou o evento como se já existissem. Registre o que está configurado e como o negócio anota o resultado comercial, mesmo que seja uma planilha. Um evento no anúncio sem registro da venda deixa o custo por lead sem sentido.`,
  }),
  heading(17, "metrica-que-importa", "Qual número vai importar"),
  block(18, "cadeia-de-metricas", true, false, {
    type: "TEXT",
    body: `A cadeia possível é impressão, clique, lead ou mensagem, lead qualificado, proposta ou agendamento e venda. Nem todo negócio tem todos esses estágios. Registre só os que você consegue reconhecer.

Custo por mensagem, custo por lead, custo por lead qualificado e custo por venda respondem perguntas diferentes. Um custo por lead baixo pode ser ruim se os contatos não servem.

Enviar depois o resultado qualificado, por CRM ou Conversions API, pode melhorar a mensuração em alguns casos. Esta aula não instala isso e não exige. A próxima aula lê os números. Ela vai precisar saber qual conversão você queria, qual estágio você mede e qual canal escolheu.`,
  }),
  block(19, "curso-nao-vai-ao-whatsapp", false, false, {
    type: "EXAMPLE",
    title: "Nem todo negócio deve abrir no WhatsApp",
    body: `O curso de tráfego pago pode ir do anúncio para uma aula gratuita, um cadastro, o diagnóstico e só então o conteúdo pago.

Mandar esse tráfego direto para uma conversa perderia o caminho em que a pessoa entende a oferta. WhatsApp é uma escolha, não a chegada obrigatória.`,
  }),
  block(20, "confirme-no-ads-manager", false, false, {
    type: "CALLOUT",
    tone: "warning",
    title: "Não existe um objetivo universal para WhatsApp",
    body: "A ajuda oficial de 19 de outubro de 2026 mostra anúncios que clicam para o WhatsApp em Reconhecimento, Tráfego, Engajamento, Leads e Vendas. O local da conversão e a meta de desempenho mudam conforme o objetivo. No Leads com WhatsApp, a meta padrão citada é Maximize number of conversations. Formulário instantâneo, nessa mesma ajuda, fica no objetivo Leads. Confirme a combinação na sua conta antes de publicar.",
  }),
  block(21, "exemplo-atendimento-local", false, false, {
    type: "EXAMPLE",
    title: "Dois contatos, um serviço",
    body: `Útil: a pessoa pede móveis planejados, está na região atendida e quer orçamento de um ambiente.

Não útil agora: a pessoa manda “oi”, pede um produto que a empresa não faz ou está fora da área. Isso não julga a pessoa. Só diz que aquele contato não é o resultado que a campanha deveria contar como qualificado.`,
  }),
  block(22, "checkpoint-lead", true, true, {
    type: "CHECKPOINT",
    question: "O que um lead representa neste curso?",
    options: [
      { id: "acao", label: "Uma ação definida pelo negócio, que ainda pode não ser venda" },
      { id: "venda", label: "Uma venda concluída" },
      { id: "oi", label: "Qualquer mensagem, mesmo sem contexto" },
    ],
    correctOptionId: "acao",
    explanation: "A mensagem ou o formulário é o começo. A receita depende de qualificação, atendimento e registro.",
  }),
  block(23, "atividade-lead-util", true, true, {
    type: "ACTIVITY",
    prompt: "Escreva, em uma frase, o que torna um contato útil para a sua oferta, sem pedir dado sensível.",
    inputType: "long_text",
  }),
  heading(24, "configuracao-da-plataforma", "Objetivo, local e meta de desempenho"),
  block(25, "objetivo-local-meta", true, false, {
    type: "TEXT",
    body: `Separe quatro decisões. O objetivo do negócio é o resultado real. O objetivo da Meta é o que a conta oferece. O local da conversão é onde a ação acontece. A meta de desempenho é o que a entrega tenta buscar.

Para Tráfego, Engajamento e Vendas, a ajuda atual chama o local de Message destinations e então permite marcar WhatsApp. Em Reconhecimento, a escolha de Messaging apps aparece no destino do anúncio. Em Leads, a conversão pode ser WhatsApp, formulário instantâneo, site ou ligação.

A interface da sua conta pode não mostrar todas essas opções. O plano guarda a combinação que você conferiu. Ele não afirma que ela existe na conta sem essa conferência.`,
  }),
  block(26, "checkpoint-caminho", true, true, {
    type: "CHECKPOINT",
    question: "Quando o caminho certo ainda não está decidido, o que fazer?",
    options: [
      { id: "conferir", label: "Escolher o caminho que o atendimento sustenta e conferir a combinação no Ads Manager" },
      { id: "engajamento", label: "Marcar Engajamento porque a conversa é no WhatsApp" },
      { id: "leads", label: "Marcar Leads porque toda mensagem é lead" },
    ],
    correctOptionId: "conferir",
    explanation: "WhatsApp não está preso a um único objetivo. A combinação válida é a que a interface atual oferece para aquela conta.",
  }),
  block(27, "atividade-perguntas", true, true, {
    type: "ACTIVITY",
    prompt: "Liste até cinco perguntas que separam um contato útil de um contato que você não consegue atender agora.",
    inputType: "long_text",
  }),
  block(28, "checklist-antes-de-anunciar", true, true, {
    type: "CHECKLIST",
    items: [
      { id: "acao", label: "Sei qual ação quero gerar." },
      { id: "ads", label: "Confirmei a configuração atual no Ads Manager." },
      { id: "canal", label: "O canal está pronto." },
      { id: "quem", label: "Sei quem atende." },
      { id: "perguntas", label: "Defini as perguntas de qualificação." },
      { id: "util", label: "Sei o que considero lead útil." },
      { id: "registro", label: "Tenho como registrar o resultado." },
      { id: "volume", label: "Consigo atender o volume esperado." },
    ],
  }),
  block(29, "plano-de-leads", true, true, {
    type: "TOOL",
    toolKey: "META_LEAD_CONVERSION_PLAN_V1",
    title: "Plano de geração e atendimento de leads",
    description:
      "Registre o caminho do contato, a configuração conferida no Ads Manager, a qualificação e quem atende. O plano não cria campanha, não pede token e não publica anúncio.",
  }),
  block(30, "checkpoint-plano-de-leads", true, true, {
    type: "CHECKPOINT",
    question: "Quando este plano pode seguir para a configuração?",
    options: [
      { id: "fluxo", label: "Quando o contato, o atendimento e o registro do resultado se sustentam" },
      { id: "botao", label: "Quando o botão de WhatsApp foi escolhido" },
      { id: "barato", label: "Quando o custo por lead parece baixo" },
    ],
    correctOptionId: "fluxo",
    explanation: "Custo baixo sem contato útil não é resultado. A prontidão é o fluxo inteiro, não o botão.",
  }),
  block(31, "conclusao-fluxo-de-lead", false, false, {
    type: "CONCLUSION",
    body: "Você sabe como o anúncio vira um contato útil, quem atende esse contato e qual estágio consegue registrar. Se o canal, a pessoa responsável ou a mensuração ainda não existem, o próximo passo é a pendência, não o anúncio no ar.",
  }),
  block(32, "proxima-aula-numeros", false, false, {
    type: "CALLOUT",
    tone: "info",
    title: "A próxima aula lê os números",
    body: "Leia os números e encontre o gargalo usa a conversão desejada, o estágio que você mede e o canal escolhido aqui. Essa aula ainda não está à venda. Disponível em breve.",
  }),
  block(33, "fontes-oficiais", true, false, {
    type: "TEXT",
    body: `As combinações desta aula foram conferidas em 19 de outubro de 2026 no Meta Business Help Center e na página de lead ads da Meta for Business.

Os artigos usados foram o objetivo Leads, os formulários instantâneos, os anúncios que clicam para mensagem e a criação de anúncios que clicam para o WhatsApp no Ads Manager. Se a sua tela usar outro nome, prevalece a interface atual. Não use um artigo antigo como mapa de cliques.`,
  }),
  block(34, "sem-aula-anterior", true, false, {
    type: "TEXT",
    body: `Se o plano da aula de objetivo e público já existe no mesmo projeto, oferta, objetivo, destino, orçamento e conjuntos entram aqui. Não preencha de novo.

Sem esse plano, a aula segue. Preencha o mínimo e volte na estrutura quando fizer sentido. O diagnóstico também é contexto: Google não impede esta aula, e uma pendência de mensuração não apaga o plano.`,
  }),
  block(35, "aula-continua-fechada", true, false, {
    type: "TEXT",
    body: `Esta aula e o módulo Meta continuam fora de venda. O plano não cria campanha, não conecta a Marketing API e não pede lista de clientes, telefone, e-mail, CPF, dado de saúde, token ou identificador de Pixel.

A estrutura simples da aula anterior deve ser preservada. Não abra um conjunto novo para cada pergunta.`,
  }),
  heading(36, "o-que-o-plano-guarda", "O que o plano guarda"),
  block(37, "resultado-para-a-proxima-aula", true, false, {
    type: "TEXT",
    body: `O resultado guarda o caminho, o objetivo da plataforma, o local da conversão, a meta de desempenho, a definição de lead, os estágios medidos e o fluxo de atendimento.

Isso é o bastante para, depois, ler impressão, clique, custo por lead e venda sem misturar projetos. Não há planilha nesta aula.`,
  }),
  block(38, "exemplo-curso-trafego", false, false, {
    type: "EXAMPLE",
    title: "Curso nacional, conversa local",
    body: `O curso pode medir cadastro no site, em todo o Brasil. A marcenaria pode medir pedido de orçamento no WhatsApp, só na área atendida.

Os dois são leads. O estágio seguinte é diferente: um pode ser a compra da aula; o outro, a visita para medir o ambiente. Conte o estágio que o negócio realmente registra.`,
  }),
];
