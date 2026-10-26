import { SITES_COURSE_SLUG } from "@/lib/learning/sites-course";

export const TRAFFIC_COURSE_SLUG = "trafego-pago-na-pratica";

export type LessonExperience = {
  slug: string;
  learns: string[];
  practices: string[];
  outcome: string;
};

export type FeaturedArtifact = {
  title: string;
  detail: string;
};

export type ComplementaryCourse = {
  slug: string;
  headline: string;
  body: string;
  cta: string;
};

export type CourseExperience = {
  slug: string;
  transformation: string;
  shortOutcome: string;
  outcomeHeadline: string;
  outcomeSteps: string[];
  benefits: string[];
  artifacts: string[];
  featuredArtifacts: FeaturedArtifact[];
  complementary: ComplementaryCourse;
  lessons: LessonExperience[];
};

const TRAFFIC_LESSONS: LessonExperience[] = [
  {
    slug: "como-funciona-o-trafego-pago",
    learns: ["O caminho entre anúncio, clique, destino e resultado, e quando anunciar faz sentido para um pequeno negócio."],
    practices: ["Monta o primeiro mapa de tráfego com a oferta e o destino do próprio negócio."],
    outcome: "Meu primeiro mapa de tráfego",
  },
  {
    slug: "google-ads-ou-meta-ads",
    learns: ["Em que situação a busca no Google e a descoberta no Meta tendem a funcionar melhor."],
    practices: ["Compara o comportamento do cliente e a oferta para escolher um ponto de partida."],
    outcome: "Indicação inicial de canal",
  },
  {
    slug: "negocio-pronto-para-anunciar",
    learns: ["Como avaliar objetivo, oferta, público, destino, mensuração e operação antes de investir."],
    practices: ["Responde o diagnóstico de prontidão aplicado ao próprio negócio."],
    outcome: "Diagnóstico com principal gargalo e próxima recomendação",
  },
  {
    slug: "objetivo-oferta-orcamento",
    learns: ["Como transformar “quero anunciar” em objetivo, oferta, conversão e um orçamento que o negócio aguenta."],
    practices: ["Preenche o brief inicial da campanha com as decisões do próprio negócio."],
    outcome: "Brief Inicial de Campanha",
  },
  {
    slug: "destino-e-mensuracao",
    learns: ["O que a pessoa encontra depois do clique e qual conversão o negócio consegue observar."],
    practices: ["Revê o destino e registra o plano de mensuração antes de publicar a campanha."],
    outcome: "Plano de Destino e Mensuração",
  },
  {
    slug: "campanha-de-pesquisa",
    learns: ["Como organizar escopo, região, orçamento, conversão e grupos de uma campanha de Pesquisa antes de abrir o Google Ads."],
    practices: ["Desenha o blueprint da campanha a partir da oferta e do território do negócio."],
    outcome: "Blueprint de Campanha de Pesquisa",
  },
  {
    slug: "palavras-chave-com-intencao",
    learns: ["A diferença entre a palavra que você configura e a busca que a pessoa digitou, e como ler intenção."],
    practices: ["Monta uma lista curta de buscas e separa o que não merece orçamento agora."],
    outcome: "Plano inicial de palavras-chave",
  },
  {
    slug: "anuncios-alinhados-a-conversao",
    learns: ["Como um anúncio responsivo combina títulos e descrições sem prometer o que a página não entrega."],
    practices: ["Escreve anúncios em que a busca, a oferta e o próximo passo dizem a mesma coisa."],
    outcome: "Plano de anúncios responsivos",
  },
  {
    slug: "objetivo-publico-estrutura",
    learns: ["Qual resultado a Meta deve procurar, quais sinais de público entregar e como não fragmentar o orçamento."],
    practices: ["Define objetivo, público e estrutura da campanha antes de criar anúncios."],
    outcome: "Plano inicial de campanha Meta",
  },
  {
    slug: "campanhas-leads-whatsapp",
    learns: ["Como o anúncio vira um contato útil e qual estágio do resultado o negócio consegue registrar."],
    practices: ["Planeja geração e atendimento de leads ou WhatsApp, incluindo quem responde."],
    outcome: "Plano de geração e atendimento de leads",
  },
  {
    slug: "leia-os-numeros",
    learns: ["O que o arquivo da campanha permite afirmar e onde a leitura ainda não sustenta uma conclusão."],
    practices: ["Diagnostica os próprios dados e marca o gargalo que os números realmente mostram."],
    outcome: "Diagnóstico dos resultados da campanha",
  },
  {
    slug: "o-que-mudar",
    learns: ["Quando a próxima decisão é executar, analisar de novo, aprender ou esperar."],
    practices: ["Transforma o diagnóstico em uma próxima ação, sem otimização aleatória."],
    outcome: "Plano de próxima ação",
  },
];

const SITES_LESSONS: LessonExperience[] = [
  {
    slug: "site-ajuda-a-vender",
    learns: ["Se a presença atual conduz o visitante de uma origem até uma ação real do negócio."],
    practices: ["Desenha o mapa Origem, Página, Ação e Resultado do próprio negócio."],
    outcome: "Mapa de conversão",
  },
  {
    slug: "site-landing-page-ou-whatsapp",
    learns: ["Quando faz mais sentido landing page, site, página de serviço, WhatsApp ou uma combinação."],
    practices: ["Escolhe a estrutura digital a partir da oferta e do próximo passo do cliente."],
    outcome: "Estrutura digital ideal",
  },
  {
    slug: "pagina-pronta-para-converter",
    learns: ["Como avaliar clareza, oferta, ação e confiança antes de investir em visual ou tráfego."],
    practices: ["Faz o diagnóstico de prontidão da página que já existe, ou do ponto de partida."],
    outcome: "Diagnóstico de prontidão",
  },
  {
    slug: "oferta-publico-acao-principal",
    learns: ["Por que a landing page começa pela oferta, pelo público e pela ação, não pelo layout."],
    practices: ["Registra o brief de conversão no projeto da própria página."],
    outcome: "Brief de conversão",
  },
  {
    slug: "jornada-do-visitante",
    learns: ["O que o visitante precisa entender, acreditar e superar antes de agir."],
    practices: ["Mapeia a sequência de decisões no mesmo projeto da landing page."],
    outcome: "Mapa de decisão do visitante",
  },
  {
    slug: "organize-as-secoes-da-pagina",
    learns: ["Como a estratégia e a jornada viram uma ordem de seções, ainda sem a copy final."],
    practices: ["Ajusta e visualiza o esqueleto real da página na plataforma."],
    outcome: "Estrutura da landing page",
  },
  {
    slug: "mensagem-que-deixa-a-oferta-clara",
    learns: ["Como escrever a mensagem de cada seção e aprovar só o que estiver claro."],
    practices: ["Compara sugestões, revisa e aprova a copy das seções principais."],
    outcome: "Copy da landing page",
  },
  {
    slug: "hierarquia-visual-e-atencao",
    learns: ["O que o visitante percebe primeiro, com contraste e destaque dentro de um tema controlado."],
    practices: ["Define a direção visual sem um editor gráfico livre."],
    outcome: "Direção visual",
  },
  {
    slug: "construa-confianca",
    learns: ["Como usar prova real do negócio sem inventar depoimento, número ou selo."],
    practices: ["Seleciona os elementos de confiança que já são verdadeiros e decide onde entram."],
    outcome: "Plano de confiança",
  },
  {
    slug: "pagina-mobile-e-experiencia",
    learns: ["O que muda quando a mesma página é lida e usada no celular."],
    practices: ["Revisa a experiência em larguras diferentes e registra o que precisa de ajuste."],
    outcome: "Revisão de experiência",
  },
  {
    slug: "configure-o-que-precisa-ser-medido",
    learns: ["Qual ação representa resultado e quais sinais acompanhar antes de escolher uma ferramenta externa."],
    practices: ["Confirma a conversão principal e o plano de mensuração da página."],
    outcome: "Plano de mensuração",
  },
  {
    slug: "revisao-antes-do-trafego",
    learns: ["O que impede a publicação e o que ainda vale revisar antes de colocar a página no ar."],
    practices: ["Corrige os bloqueios e publica uma versão real da landing page na plataforma."],
    outcome: "Landing page publicada",
  },
];

const TRAFFIC_EXPERIENCE: CourseExperience = {
  slug: TRAFFIC_COURSE_SLUG,
  transformation:
    "Você termina capaz de planejar uma campanha, escolher o canal adequado, estruturar Google ou Meta, interpretar os próprios dados e decidir o próximo passo com critério.",
  shortOutcome: "Planejar, medir e decidir a próxima ação com os seus próprios dados.",
  outcomeHeadline: "Você não termina sabendo apenas onde clicar.",
  outcomeSteps: ["Planejar", "Executar", "Medir", "Diagnosticar", "Decidir"],
  benefits: [
    "Decidir se e quando anunciar",
    "Escolher Google ou Meta com critério",
    "Estruturar a campanha antes de abrir a plataforma",
    "Planejar destino e mensuração",
    "Trabalhar palavras-chave por intenção",
    "Construir anúncios coerentes com a oferta",
    "Planejar geração e atendimento de leads",
    "Analisar os próprios dados",
    "Identificar o gargalo que os números sustentam",
    "Escolher a próxima ação sem otimização aleatória",
  ],
  artifacts: [
    "Meu primeiro mapa de tráfego",
    "Indicação inicial de canal",
    "Diagnóstico de Prontidão",
    "Brief Inicial de Campanha",
    "Plano de Destino e Mensuração",
    "Blueprint de Campanha de Pesquisa",
    "Plano inicial de palavras-chave",
    "Plano de anúncios responsivos",
    "Plano inicial de campanha Meta",
    "Plano de geração e atendimento de leads",
    "Diagnóstico dos resultados da campanha",
    "Plano de próxima ação",
  ],
  featuredArtifacts: [
    { title: "Blueprint de Campanha de Pesquisa", detail: "A estrutura da campanha fica pronta antes de abrir o Google Ads." },
    { title: "Diagnóstico de Prontidão", detail: "O gargalo principal e a próxima recomendação, antes de aumentar o investimento." },
    { title: "Plano de próxima ação", detail: "Uma decisão de executar, analisar, aprender ou esperar, com critério." },
    { title: "Brief Inicial de Campanha", detail: "Objetivo, oferta, conversão e orçamento no mesmo plano." },
  ],
  complementary: {
    slug: SITES_COURSE_SLUG,
    headline: "Já consegue atrair pessoas, mas o destino ainda precisa evoluir?",
    body: "Sites que Convertem ensina a planejar, construir e publicar a landing page na plataforma. Talvez você já domine o anúncio e o próximo gargalo seja a página.",
    cta: "Conhecer Sites que Convertem",
  },
  lessons: TRAFFIC_LESSONS,
};

const SITES_EXPERIENCE: CourseExperience = {
  slug: SITES_COURSE_SLUG,
  transformation: "Você planeja, constrói, revisa e publica a própria landing page na plataforma, sem precisar programar.",
  shortOutcome: "Uma landing page real, publicada na plataforma, construída a partir do seu negócio.",
  outcomeHeadline: "Você não termina com um exercício.",
  outcomeSteps: ["Brief", "Estrutura", "Copy", "Visual", "Revisão", "Publicação"],
  benefits: [
    "Entender a jornada do visitante",
    "Escolher a estrutura digital correta",
    "Diagnosticar a prontidão da página",
    "Definir oferta, público e ação",
    "Mapear a decisão até a ação",
    "Montar a estrutura da página",
    "Escrever e aprovar a copy",
    "Criar hierarquia visual",
    "Usar provas reais do negócio",
    "Revisar a experiência no celular",
    "Configurar a mensuração",
    "Publicar uma versão real da landing page",
  ],
  artifacts: [
    "Mapa de conversão",
    "Estrutura digital ideal",
    "Diagnóstico de prontidão",
    "Brief de conversão",
    "Mapa de decisão do visitante",
    "Estrutura da landing page",
    "Copy da landing page",
    "Direção visual",
    "Plano de confiança",
    "Revisão de experiência",
    "Plano de mensuração",
    "Landing page publicada",
  ],
  featuredArtifacts: [
    { title: "Brief de conversão", detail: "Oferta, público e ação principal registrados antes do layout." },
    { title: "Estrutura da landing page", detail: "As seções reais da página, na ordem da decisão do visitante." },
    { title: "Copy da landing page", detail: "A mensagem de cada seção, revisada e aprovada por você." },
    { title: "Landing page publicada", detail: "Uma versão no ar na plataforma, sem exportar código nem abrir um CMS." },
  ],
  complementary: {
    slug: TRAFFIC_COURSE_SLUG,
    headline: "Sua página já está estruturada? Talvez o próximo gargalo seja trazer as pessoas certas até ela.",
    body: "Tráfego Pago na Prática ensina a escolher o canal, estruturar a campanha e ler os próprios dados. Talvez você já tenha a página e precise do caminho até ela.",
    cta: "Conhecer Tráfego Pago",
  },
  lessons: SITES_LESSONS,
};

const EXPERIENCES = [TRAFFIC_EXPERIENCE, SITES_EXPERIENCE];

export function courseExperience(slug: string): CourseExperience | null {
  return EXPERIENCES.find((experience) => experience.slug === slug) ?? null;
}

export function lessonExperience(courseSlug: string, lessonSlug: string): LessonExperience | null {
  return courseExperience(courseSlug)?.lessons.find((lesson) => lesson.slug === lessonSlug) ?? null;
}

export function courseExperiences(): CourseExperience[] {
  return EXPERIENCES;
}
