import type { LessonBlockData } from "@/lib/learning/blocks";

export const LESSON_06_SLUG = "campanha-de-pesquisa";

export const lesson06Meta = {
  title: "Estruture uma campanha de Pesquisa",
  summary:
    "Planeje a estrutura da sua primeira campanha de Pesquisa no Google Ads, definindo escopo, localização, orçamento, conversão e grupos de anúncios antes de entrar na plataforma.",
  publicPreview:
    "Uma campanha de Pesquisa bem estruturada começa antes da escolha das palavras-chave. Nesta aula você organizará oferta, objetivo, região, orçamento e grupos de anúncios em um Blueprint aplicado ao seu próprio negócio.",
  estimatedMinutes: 40,
  accessType: "PAID" as const,
  priceCents: 3990,
  commerceStatus: "NOT_FOR_SALE" as const,
};

export type Lesson06Block = {
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
): Lesson06Block {
  return { position, blockKey, countsForProgress, required, data };
}

const heading = (position: number, blockKey: string, text: string) =>
  block(position, blockKey, false, false, { type: "HEADING", level: 2, text });

export const lesson06Blocks: Lesson06Block[] = [
  heading(1, "campanha-antes-da-plataforma", "A estrutura vem antes da configuração"),
  block(2, "pesquisa-nao-comeca-palavra-chave", true, false, {
    type: "TEXT",
    body: `Quando alguém pensa em Google Ads para Pesquisa, é comum começar imediatamente pelas palavras-chave.

Mas existe uma etapa anterior.

Antes de escolher o que as pessoas podem pesquisar, precisamos decidir:

- o que esta campanha pretende promover;
- qual resultado ela busca;
- onde ela deve atuar;
- qual destino será utilizado;
- quanto poderá investir;
- como os temas serão organizados.

Pense na campanha como uma estrutura que receberá as palavras-chave e os anúncios depois.

Se essa estrutura começa confusa, adicionar centenas de palavras-chave não resolve.

Nesta aula você montará o Blueprint da sua campanha.

Na próxima, transformaremos os grupos planejados aqui em conjuntos de palavras-chave com intenção de compra.`,
  }),
  block(3, "nao-abra-google-ainda", true, false, {
    type: "CALLOUT",
    tone: "info",
    title: "Você ainda não precisa abrir o Google Ads",
    body: `É possível tomar várias das decisões mais importantes da campanha antes de entrar na plataforma.

Isso reduz a chance de escolher configurações apenas porque foram sugeridas pela interface.

A plataforma ajuda a executar sua estratégia.

Ela não deve decidir toda a estratégia por você.`,
  }),
  heading(4, "hierarquia-pesquisa", "Entenda a hierarquia"),
  block(5, "campanha-grupo-palavra-anuncio", true, false, {
    type: "TEXT",
    body: `Para esta etapa do curso, pense em quatro níveis.

Campanha

Define o escopo maior.

É onde decisões como orçamento, região e parte da estratégia de distribuição são organizadas.

Grupo de anúncios

Agrupa uma intenção ou tema comercial coerente.

Palavras-chave

Ajudam a conectar pesquisas relevantes aos grupos.

Anúncios

Apresentam a mensagem que deve responder àquela intenção.

Uma estrutura simplificada pode ser:

Campanha:
Serviços de Ultrassonografia

Grupo:
Ultrassom Obstétrico

Palavras:
serão definidas na próxima aula.

Anúncios:
serão produzidos depois.

Essa separação ajuda a evitar uma campanha em que tudo fala sobre tudo.`,
  }),
  block(6, "checkpoint-hierarquia-pesquisa", true, true, {
    type: "CHECKPOINT",
    question: "Qual elemento deve agrupar buscas que podem receber uma mensagem comercial semelhante?",
    options: [
      { id: "grupo-de-anuncios", label: "O grupo de anúncios." },
      { id: "metodo-de-pagamento", label: "O método de pagamento." },
      { id: "dominio-do-site", label: "O domínio do site." },
      { id: "conta-do-google", label: "A conta do Google." },
    ],
    correctOptionId: "grupo-de-anuncios",
    explanation:
      "O grupo de anúncios organiza temas ou intenções coerentes. Depois, palavras-chave e anúncios relacionados a esse tema podem ser construídos dentro dele.",
  }),
  heading(7, "defina-escopo", "Defina o que esta campanha vai promover"),
  block(8, "uma-campanha-um-escopo", true, false, {
    type: "TEXT",
    body: `Sua empresa pode oferecer muitas coisas.

Isso não significa que todas precisam entrar na mesma campanha.

Um escopo mais claro facilita:

- controlar orçamento;
- interpretar resultado;
- organizar grupos;
- escrever anúncios;
- decidir destinos.

Imagine uma clínica que oferece:

- ultrassonografia;
- consultas;
- exames laboratoriais;
- procedimentos.

Colocar todos esses serviços na mesma estrutura pode dificultar a leitura.

Uma campanha pode começar, por exemplo, apenas com:

Ultrassonografia

e organizar tipos de exame em grupos coerentes.

A melhor divisão depende do negócio.

O princípio é evitar juntar coisas diferentes apenas porque pertencem à mesma empresa.`,
  }),
  block(9, "exemplo-escola-estrutura", true, false, {
    type: "EXAMPLE",
    title: "Exemplo: uma escola com vários cursos",
    body: `Uma escola oferece:

- Programação Web;
- Design Gráfico;
- Manutenção de Computadores;
- Social Media.

Uma estrutura inicial possível seria ter uma campanha específica para uma formação prioritária.

Por exemplo:

Campanha:
Programação Web

Grupo 1:
Curso de Programação Web

Grupo 2:
Curso Front-end

Grupo 3:
Curso para Iniciantes

Não estamos escolhendo palavras-chave ainda.

Estamos apenas organizando temas que provavelmente precisarão de mensagens coerentes.`,
  }),
  heading(10, "objetivo-e-conversao-search", "Leve o objetivo e a conversão para a campanha"),
  block(11, "search-nao-muda-objetivo-negocio", true, false, {
    type: "TEXT",
    body: `Escolher Google Search não muda o objetivo definido anteriormente.

Se seu Brief dizia:

Objetivo:
receber solicitações de orçamento.

Conversão:
formulário enviado.

A campanha de Pesquisa deve ser estruturada em torno dessa lógica.

Não troque o resultado de negócio apenas porque a plataforma oferece diversas métricas.

Cliques, impressões, taxa de cliques e posição podem ajudar na análise.

Mas não substituem a conversão que representa valor para o negócio.`,
  }),
  block(12, "nao-otimize-sinal-ruim", true, false, {
    type: "CALLOUT",
    tone: "info",
    title: "Uma estratégia automática aprende com o sinal que você oferece",
    body: `Se você disser à plataforma para buscar conversões, é importante que a conversão configurada represente uma ação útil e esteja sendo registrada corretamente.

Automação sobre um sinal ruim continua sendo um problema.`,
  }),
  heading(13, "onde-anuncio-deve-aparecer", "Onde seu cliente precisa estar?"),
  block(14, "localizacao-cliente-nao-empresa", true, false, {
    type: "TEXT",
    body: `A localização da campanha deve acompanhar o mercado atendido, não apenas o endereço da empresa.

Uma clínica física em Belém provavelmente depende de pacientes que possam chegar à unidade.

Um desenvolvedor que presta serviço remotamente pode atender clientes em todo o Brasil.

Nos dois casos, a empresa pode estar no mesmo lugar fisicamente, mas a estratégia geográfica é diferente.

Pergunte:

“Em quais lugares uma pessoa precisa estar para ser um cliente viável desta oferta?”

Ao configurar a campanha posteriormente, revise também como a plataforma interpreta presença e interesse geográfico.

Não aceite uma opção apenas porque veio selecionada por padrão.`,
  }),
  block(15, "checkpoint-localizacao", true, true, {
    type: "CHECKPOINT",
    question:
      "Um profissional trabalha em Belém, mas presta seu serviço integralmente online para clientes de todo o Brasil. Qual raciocínio é mais adequado?",
    options: [
      { id: "apenas-belem", label: "Anunciar obrigatoriamente apenas em Belém porque é onde ele mora." },
      { id: "mercado-atendido", label: "Definir a localização com base no mercado que realmente consegue atender." },
      { id: "sem-localizacao", label: "Não usar localização em nenhuma campanha." },
      { id: "sempre-o-estado", label: "Escolher sempre o estado inteiro onde fica a empresa." },
    ],
    correctOptionId: "mercado-atendido",
    explanation:
      "A segmentação geográfica deve refletir onde estão os clientes que podem receber a oferta, não simplesmente o endereço físico do anunciante.",
  }),
  heading(16, "orcamento-e-foco", "Orçamento e foco de otimização"),
  block(17, "orcamento-na-estrutura", true, false, {
    type: "TEXT",
    body: `Na Aula 4 você definiu quanto consegue investir.

Agora esse orçamento entra na estrutura da campanha.

Se você planejou R$ 600 para o mês, sua referência simples de planejamento foi aproximadamente R$ 20 por dia.

Ao configurar a plataforma, você trabalhará com o modelo de orçamento disponível naquele ambiente.

O ponto importante é manter coerência entre:

- quanto pretende investir;
- quantidade de campanhas;
- quantidade de testes;
- duração;
- capacidade de gerar dados.

Um orçamento limitado espalhado por muitas campanhas pode dificultar a aprendizagem.

É melhor saber o que está testando do que simplesmente aumentar a quantidade de estruturas.`,
  }),
  block(18, "foco-otimizacao", true, false, {
    type: "TEXT",
    body: `Também precisamos registrar qual será o foco inicial da campanha.

Conversões

Faz sentido quando você possui uma ação de conversão relevante e uma estrutura de mensuração suficientemente confiável para orientar a campanha.

Tráfego ou cliques para aprendizado inicial

Pode fazer parte de determinados testes quando o objetivo imediato é começar a observar procura e comportamento, especialmente se a mensuração de conversões ainda não está pronta.

Mas clique não deve se tornar o resultado final do negócio.

Ainda não sei

Também é uma resposta válida.

Se a mensuração ainda está confusa, é melhor registrar a dúvida do que fingir certeza.

A estratégia de lances deve servir ao objetivo.

Não o contrário.`,
  }),
  block(19, "checkpoint-foco-otimizacao", true, true, {
    type: "CHECKPOINT",
    question: "Uma empresa quer otimizar a campanha para uma conversão, mas descobriu que o evento dispara incorretamente. Qual decisão é mais coerente?",
    options: [
      { id: "ignorar-o-erro", label: "Ignorar o erro porque a automação corrigirá sozinha." },
      { id: "aumentar-orcamento", label: "Aumentar o orçamento." },
      { id: "corrigir-o-sinal", label: "Corrigir ou validar o sinal de conversão antes de depender dele como orientação da campanha." },
      { id: "mais-grupos", label: "Criar mais grupos de anúncios." },
    ],
    correctOptionId: "corrigir-o-sinal",
    explanation:
      "Uma estratégia orientada por conversões depende da qualidade do sinal. Um evento incorreto pode levar a decisões baseadas em dados que não representam o resultado real.",
  }),
  heading(20, "marca-e-nao-marca", "Busca pela sua marca é diferente de busca pela solução"),
  block(21, "separacao-marca", true, false, {
    type: "TEXT",
    body: `Compare estas duas pesquisas:

“Alexandre Feio tráfego pago”

e:

“gestor de tráfego pago”

Na primeira, a pessoa já conhece um nome específico.

Na segunda, ela procura uma solução.

As duas buscas podem ter valor.

Mas representam intenções diferentes.

Quando existe volume suficiente de busca pela marca, separar esse tráfego pode facilitar a análise.

Caso contrário, uma campanha pode parecer excelente porque recebe muitas pessoas que já estavam procurando especificamente pela empresa.

Isso não significa que você seja obrigado a criar uma campanha de marca.

Significa apenas que deve reconhecer a diferença.`,
  }),
  block(22, "marca-nao-e-nova-demanda", true, false, {
    type: "CALLOUT",
    tone: "info",
    title: "Busca de marca merece contexto",
    body: `Uma conversão originada de alguém que já procurava pelo nome da sua empresa não representa exatamente o mesmo desafio de conquistar uma pessoa que buscava genericamente por uma solução.

Analise esses comportamentos com contexto.`,
  }),
  heading(23, "grupos-de-anuncios", "Organize por intenção, não por bagunça"),
  block(24, "logica-grupos", true, false, {
    type: "TEXT",
    body: `O grupo de anúncios ajuda a organizar pesquisas que podem receber uma mensagem coerente.

Imagine uma clínica.

Misturar no mesmo grupo buscas sobre:

- ultrassom obstétrico;
- ultrassom morfológico;
- ultrassom de tireoide;
- ultrassom abdominal;

pode dificultar a criação de uma mensagem realmente alinhada a cada intenção.

Agora imagine grupos como:

Ultrassom Obstétrico

Ultrassom Morfológico

Ultrassom Abdominal

Cada grupo pode depois receber palavras-chave e anúncios mais específicos.

Mas cuidado com o extremo oposto.

Você não precisa criar dezenas de grupos apenas para parecer organizado.

Crie separações quando elas ajudam a manter:

intenção
+
mensagem
+
destino

coerentes.`,
  }),
  block(25, "exemplo-grupos-bons-ruins", true, false, {
    type: "EXAMPLE",
    title: "Uma estrutura muito ampla e outra mais clara",
    body: `Estrutura ampla demais:

Grupo:
“Serviços”

Dentro dele:
curso de programação
design gráfico
manutenção de computador
social media

Fica difícil escrever uma mensagem coerente.

Estrutura mais clara:

Campanha:
Programação Web

Grupo:
Curso de Programação Web

Intenção:
pessoas procurando formação em programação web.

Grupo:
Programação para Iniciantes

Intenção:
pessoas que querem começar a aprender programação.

As palavras específicas serão trabalhadas na próxima aula.`,
  }),
  block(26, "checkpoint-grupos-coerentes", true, true, {
    type: "CHECKPOINT",
    question: "Qual é o melhor motivo para criar grupos de anúncios diferentes?",
    options: [
      { id: "maior-numero", label: "Ter o maior número possível de grupos." },
      { id: "separar-intencoes", label: "Separar intenções que precisam de mensagens ou destinos diferentes." },
      { id: "um-por-palavra", label: "Criar exatamente um grupo para cada palavra-chave." },
      { id: "parecer-avancada", label: "Fazer a campanha parecer mais avançada." },
    ],
    correctOptionId: "separar-intencoes",
    explanation:
      "A separação existe para aumentar a coerência entre intenção de busca, mensagem e destino. Quantidade por si só não melhora a estrutura.",
  }),
  heading(27, "parceiros-e-decisoes", "Nem toda decisão precisa estar fechada hoje"),
  block(28, "decisoes-configuracao", true, false, {
    type: "TEXT",
    body: `Durante a configuração real, você encontrará decisões adicionais.

Uma delas pode envolver parceiros de pesquisa.

Outra pode envolver detalhes de idioma, distribuição, automação e configurações recomendadas pela própria plataforma.

Não é necessário decorar todas essas opções agora.

O princípio é:

entenda o que cada configuração altera antes de aceitá-la.

Se você ainda não possui uma hipótese sobre determinada escolha, registre:

“Ainda preciso decidir.”

Isso é melhor do que transformar uma sugestão automática da interface em estratégia sem compreender seu efeito.`,
  }),
  heading(29, "monte-blueprint", "Monte o Blueprint da sua campanha"),
  block(30, "blueprint-campanha-pesquisa", true, true, {
    type: "TOOL",
    toolKey: "SEARCH_CAMPAIGN_BLUEPRINT_V1",
    title: "Blueprint de Campanha de Pesquisa",
    description: `Agora transforme as decisões desta aula em uma estrutura aplicável ao seu projeto.

Você organizará:

- campanha;
- oferta;
- objetivo;
- conversão;
- destino;
- localização;
- orçamento;
- foco de otimização;
- estratégia de marca;
- parceiros de pesquisa;
- grupos de anúncios.

Na próxima aula, cada grupo poderá receber suas palavras-chave.`,
  }),
  heading(31, "blueprint-nao-e-campanha", "O Blueprint ainda não é a campanha publicada"),
  block(32, "use-blueprint-como-guia", true, false, {
    type: "TEXT",
    body: `Seu Blueprint organiza as decisões antes da implementação.

Ao entrar no Google Ads, alguma configuração pode precisar de ajuste.

Isso é normal.

O importante é que agora você consegue explicar:

- o que esta campanha promove;
- o que deseja gerar;
- onde deve atuar;
- qual conversão importa;
- quanto pretende investir;
- quais grupos representam as principais intenções.

Você deixa de navegar pela plataforma perguntando:

“O que eu coloco aqui?”

e passa a comparar as opções da plataforma com uma estratégia que já existe.`,
  }),
  block(33, "checkpoint-final-blueprint", true, true, {
    type: "CHECKPOINT",
    question: "Qual situação demonstra que uma campanha de Pesquisa está melhor estruturada antes da escolha das palavras-chave?",
    options: [
      { id: "grupos-sem-relacao", label: "Possui dezenas de grupos sem relação clara." },
      { id: "estrutura-definida", label: "Já definiu oferta, objetivo, conversão, localização, orçamento e grupos baseados em intenções coerentes." },
      { id: "copiou-concorrente", label: "Copiou a estrutura de um concorrente." },
      { id: "recomendacoes-automaticas", label: "Escolheu todas as recomendações automáticas da plataforma." },
    ],
    correctOptionId: "estrutura-definida",
    explanation:
      "A estrutura cria o contexto necessário para que palavras-chave e anúncios sejam escolhidos com coerência em vez de serem adicionados aleatoriamente.",
  }),
  block(34, "conclusao-aula-06", true, false, {
    type: "CONCLUSION",
    body: `A estrutura está pronta para receber intenção de busca

Você ainda não escolheu as palavras-chave.

E isso foi proposital.

Agora existe uma estrutura para recebê-las.

Seu Blueprint já define:

- oferta;
- objetivo;
- conversão;
- destino;
- localização;
- orçamento;
- foco inicial;
- grupos de anúncios.

Na próxima aula vamos responder:

“Quais pesquisas realmente merecem entrar nesses grupos?”

Você aprenderá a diferenciar palavras relacionadas ao assunto de palavras que demonstram intenção comercial.

E construirá a lista de palavras-chave da sua própria campanha.

Próxima recomendação:

Escolha palavras-chave com intenção de compra.`,
  }),
];
