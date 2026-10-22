import type { LessonBlockData } from "@/lib/learning/blocks";
import { LANDING_PAGE_TRUST_TOOL, SITE_TRUST_SLUG } from "@/lib/landing-page/trust/plan";

export const SITE_LESSON_09_SLUG = SITE_TRUST_SLUG;

export const siteLesson09Meta = {
  title: "Construa confiança antes de pedir a ação",
  summary: "Mostre elementos reais do seu negócio antes de pedir que o visitante avance.",
  publicPreview:
    "Clareza ajuda o visitante a entender a oferta. Confiança reduz a insegurança. Nesta aula você usa só o que já é verdadeiro.",
  estimatedMinutes: 30,
  accessType: "PAID" as const,
  priceCents: 3490,
  commerceStatus: "NOT_FOR_SALE" as const,
};

export type SiteLesson09Block = {
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
): SiteLesson09Block {
  return { position, blockKey, countsForProgress, required, data };
}

const heading = (position: number, blockKey: string, text: string) =>
  block(position, blockKey, false, false, { type: "HEADING", level: 2, text });

const yesNo = () => [
  { id: "sim", label: "Sim" },
  { id: "nao", label: "Não" },
];

export const siteLesson09Blocks: SiteLesson09Block[] = [
  heading(1, "confianca-antes-da-acao", "Confiança antes da ação"),
  block(2, "pergunta-de-abertura", true, false, {
    type: "TEXT",
    body: `Você confiaria em uma página que faz muitas promessas, mas não mostra quem está por trás, como funciona ou qualquer evidência do que afirma?

Clareza gera compreensão. Confiança reduz insegurança. São coisas diferentes. Uma página pode explicar bem a oferta e, ainda assim, deixar o visitante sem elementos reais para avançar com segurança.`,
  }),
  heading(3, "nem-toda-prova-e-igual", "Nem todo negócio precisa da mesma prova"),
  block(4, "formas-de-confianca", true, false, {
    type: "TEXT",
    body: `Não parta da ideia de que toda landing page precisa de depoimentos. Um negócio pode gerar confiança por portfólio, identificação profissional, processo, experiência real, credenciais, informações da empresa, cases, depoimentos, demonstrações ou transparência sobre como o trabalho acontece.

O que importa é o que você realmente possui hoje.`,
  }),
  block(5, "tres-negocios", true, false, {
    type: "EXAMPLE",
    title: "Três formas diferentes de confiança",
    body: `Negócio A tem portfólio, mas não tem depoimentos. Mostra projetos e entregas reais.

Negócio B é um profissional com credencial e um processo claro. Não inventa clientes.

Negócio C já possui depoimentos autorizados. Usa a fala real de pessoas reais, com permissão para aparecer na página.`,
  }),
  heading(6, "nao-invente-autoridade", "Negócio novo não precisa inventar autoridade"),
  block(7, "se-ainda-nao-tem", true, false, {
    type: "CALLOUT",
    title: "Se você ainda não possui depoimentos ou cases, não invente",
    tone: "warning",
    body: "Confiança não vem de frases genéricas, selos inventados, números inventados, clientes fictícios ou depoimentos fabricados. Ela vem de informações reais, contexto, transparência e evidências apropriadas.",
  }),
  block(8, "o-que-ja-e-verdadeiro", true, false, {
    type: "TEXT",
    body: `Descubra o que já existe de verdadeiro. Pode ser quem executa o serviço, uma formação real, o processo, um portfólio inicial, experiência anterior, transparência sobre como funciona, ou um endereço e formas reais de contato.

Nenhum desses itens precisa ser inventado para a página parecer maior do que o negócio é.`,
  }),
  heading(9, "prova-nao-e-promessa", "Prova não é promessa"),
  block(10, "promessa-e-evidencia", true, false, {
    type: "EXAMPLE",
    title: "Separe o que você afirma do que pode mostrar",
    body: `“Somos os melhores” é uma promessa. “Veja trabalhos que já realizamos” aponta para algo que existe.

“Resultados garantidos” é uma promessa. “Veja como funciona nosso processo” mostra um caminho real. Um adjetivo não substitui evidência.`,
  }),
  heading(11, "depoimento-e-consentimento", "Depoimento é fala real"),
  block(12, "depoimento-real", true, false, {
    type: "TEXT",
    body: `Depoimento é a fala real de uma pessoa real. Não edite de um jeito que altere o sentido. Não invente o autor. Não invente a foto.

Antes de publicar um depoimento, confirme que você tem autorização para usar esse conteúdo. Isso não é uma consultoria jurídica. É a confirmação de que você pode usar aquele material em público. Sem essa confirmação, o depoimento permanece em rascunho.`,
  }),
  block(13, "checkpoint-nao-inventar", true, true, {
    type: "CHECKPOINT",
    question: "Se você ainda não tem depoimentos, deve criar exemplos para a página parecer mais confiável?",
    options: yesNo(),
    correctOptionId: "nao",
    explanation: "Não. Se o depoimento não existe, ele não entra na página. Outras provas reais podem ser suficientes.",
  }),
  heading(14, "portfolio-e-case", "Portfólio e case não são a mesma coisa"),
  block(15, "o-que-o-portfolio-mostra", true, false, {
    type: "TEXT",
    body: `Portfólio mostra o trabalho. Não precisa mostrar resultado financeiro. Pode mostrar um projeto, uma entrega, um produto, um antes e depois real quando isso for apropriado, ou a aplicação do serviço.

O nome do cliente não é obrigatório. A imagem também pode entrar depois, se o envio estiver indisponível.`,
  }),
  block(16, "o-que-o-case-mostra", true, false, {
    type: "TEXT",
    body: `O case tem contexto: a situação, o que foi feito e o resultado, se ele for realmente conhecido. O resultado é opcional. Não invente métrica e não transforme uma observação qualitativa em número.

Quando houver resultado, ele fica marcado como informado por você.`,
  }),
  heading(17, "outras-provas-reais", "Credencial, experiência, processo e informações"),
  block(18, "provas-factuais", true, false, {
    type: "TEXT",
    body: `Credencial pode ser formação, certificação, registro ou qualificação, desde que seja real. A plataforma não chama isso de verificado.

Experiência é informação factual que você informa, como “12 anos atuando na área”. A página não calcula nem infere esse tempo sozinha.

Processo claro também reduz insegurança, mas só se as etapas forem reais. Informações do negócio podem incluir quem está por trás, localização, canais de contato, como funciona ou políticas relevantes. Não é obrigatório informar CNPJ, registro ou endereço quando isso não se aplica.`,
  }),
  block(19, "exemplo-de-processo", true, false, {
    type: "EXAMPLE",
    title: "Um processo só entra se for o processo real",
    body: `1. Contato. 2. Diagnóstico. 3. Proposta. 4. Execução. 5. Entrega.

Essa sequência só ajuda a construir confiança quando descreve o que de fato acontece. Se as etapas já estão na página, você pode confirmá-las. Elas não são copiadas para uma segunda lista diferente.`,
  }),
  block(20, "checkpoint-processo", true, true, {
    type: "CHECKPOINT",
    question: "Um processo claro pode ajudar a construir confiança mesmo sem depoimentos?",
    options: yesNo(),
    correctOptionId: "sim",
    explanation: "Sim. Um processo real mostra como o trabalho acontece e pode reduzir insegurança sem depoimentos.",
  }),
  heading(21, "o-que-nao-e-prova", "O que não é prova"),
  block(22, "adjetivo-nao-substitui", true, false, {
    type: "TEXT",
    body: `“Qualidade garantida”, “Excelência”, “Somos referência” e “Centenas de clientes” não são prova quando não têm fundamento. Adjetivo não substitui evidência.

Use a ferramenta para cadastrar o que é factual. O estado visível é “Rascunho” ou “Pronto para usar”. Não existe selo de verificado.`,
  }),
  block(23, "checkpoint-credencial", true, true, {
    type: "CHECKPOINT",
    question: "Uma credencial enviada pelo aluno deve ser apresentada como verificada pela plataforma?",
    options: yesNo(),
    correctOptionId: "nao",
    explanation: "Não. A credencial aparece como informação sua. A plataforma não a verifica e não exibe um selo de verificação.",
  }),
  block(24, "checkpoint-fato-antes", true, true, {
    type: "CHECKPOINT",
    question: "Uma prova real deve existir antes de ser apresentada como fato na página?",
    options: yesNo(),
    correctOptionId: "sim",
    explanation: "Sim. Primeiro o fato existe. Depois ele pode ser mostrado. A página não apresenta como fato algo que ainda não foi informado.",
  }),
  heading(25, "inventario", "O que você realmente possui hoje"),
  block(26, "checklist-inventario", true, true, {
    type: "CHECKLIST",
    items: [
      { id: "depoimentos", label: "Depoimentos" },
      { id: "portfolio", label: "Portfólio" },
      { id: "cases", label: "Cases" },
      { id: "credenciais", label: "Credenciais" },
      { id: "experiencia", label: "Experiência" },
      { id: "processo", label: "Processo" },
      { id: "informacoes", label: "Informações institucionais" },
      { id: "nenhum", label: "Nenhum ainda" },
    ],
  }),
  block(27, "imagem-nao-bloqueia", true, false, {
    type: "CALLOUT",
    tone: "info",
    title: "Imagem não é obrigatória para concluir",
    body: "Credencial, case e depoimento não ficam bloqueados só porque não há imagem. Se o envio estiver indisponível, continue com as informações e adicione as imagens depois. Enviar um arquivo não conclui a aula.",
  }),
  block(28, "ferramenta-confianca", true, true, {
    type: "TOOL",
    toolKey: LANDING_PAGE_TRUST_TOOL,
    title: "Plano de confiança da minha landing page",
    description:
      "Veja as provas já informadas, cadastre elementos reais, confirme autorização de depoimentos e escolha o que pode aparecer na página.",
  }),
  block(29, "resultado-confianca", false, true, {
    type: "RESULT",
    title: "Plano de confiança da minha landing page",
    prompt: "O resumo fica no resultado da aula. As provas e as imagens continuam no projeto da página.",
    fields: [
      { key: "prontas", label: "Prontas para usar" },
      { key: "selecionadas", label: "Selecionadas" },
      { key: "depoimentos", label: "Depoimentos" },
      { key: "portfolio", label: "Portfólio" },
      { key: "credenciais", label: "Credenciais" },
      { key: "consentimento", label: "Consentimento pendente" },
      { key: "proximos", label: "Próximos passos" },
      { key: "midias", label: "Imagens" },
    ],
  }),
  heading(30, "o-que-a-pagina-pode-mostrar", "O que a página pode mostrar agora"),
  block(31, "conclusao-confianca", true, false, {
    type: "CONCLUSION",
    body: "Agora sua landing page não depende apenas do que você diz sobre sua oferta. Ela também pode mostrar elementos reais que ajudam o visitante a confiar.",
  }),
  block(32, "proxima-experiencia", true, false, {
    type: "TEXT",
    body: `Na próxima etapa, vamos revisar como essa página funciona quando alguém realmente tenta ler, navegar e agir — principalmente no celular.

A próxima aula se chama “Prepare sua página para o celular e uma boa experiência”.`,
  }),
  block(33, "voce-decide-a-secao", true, false, {
    type: "TEXT",
    body: "Você decide se as provas entram na seção de confiança que já existe ou se faz sentido acrescentar portfólio e depoimentos. Não é obrigatório criar uma seção nova. Sem depoimentos prontos, a página não mostra cartões vazios.",
  }),
];
