import type { LessonBlockData } from "@/lib/learning/blocks";

export const LESSON_07_SLUG = "palavras-chave-com-intencao";
export const LESSON_08_SLUG = "anuncios-alinhados-a-conversao";

export const lesson07Meta = {
  title: "Escolha palavras-chave com intenção de compra",
  summary:
    "Monte uma lista curta de buscas que combinam com a sua oferta, separe o que não merece orçamento agora e deixe os grupos prontos para os anúncios.",
  publicPreview:
    "Palavra-chave é a regra que você configura. Termo de pesquisa é o que a pessoa digitou. Esta aula ensina a escolher poucas buscas, pela intenção, antes de disputar o clique.",
  estimatedMinutes: 35,
  accessType: "PAID" as const,
  priceCents: 3990,
  commerceStatus: "NOT_FOR_SALE" as const,
};

export type Lesson07Block = {
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
): Lesson07Block {
  return { position, blockKey, countsForProgress, required, data };
}

const heading = (position: number, blockKey: string, text: string) =>
  block(position, blockKey, false, false, { type: "HEADING", level: 2, text });

export const lesson07Blocks: Lesson07Block[] = [
  heading(1, "palavra-nao-e-termo", "A palavra-chave não é o que a pessoa digitou"),
  block(2, "regra-e-termo", true, false, {
    type: "TEXT",
    body: `Na aula anterior você organizou a campanha: oferta, objetivo, destino e grupos.

Agora a pergunta muda.

Quais buscas você realmente quer disputar e quais não quer pagar para receber?

Para responder, separe dois nomes que o Google Ads usa de formas diferentes.

Palavra-chave é a regra configurada no grupo de anúncios.

Termo de pesquisa é aquilo que a pessoa realmente digitou ou falou.

A palavra-chave tenta alcançar pesquisas. O termo de pesquisa é a pesquisa que aconteceu.

Uma lista útil começa pequena. Ela não tenta cobrir todo mundo que poderia, um dia, se interessar pelo assunto.`,
  }),
  block(3, "keyword-e-regra", true, false, {
    type: "CALLOUT",
    tone: "info",
    title: "Regra e pesquisa não são a mesma coisa",
    body: `Você escolhe a palavra-chave antes da campanha rodar.

O termo de pesquisa só aparece depois, quando alguém de fato pesquisa.

Por isso a lista inicial é uma hipótese. Ela será revisada com os termos reais, não “fechada para sempre” no primeiro dia.`,
  }),
  block(4, "exemplo-advogado-trabalhista", true, false, {
    type: "EXAMPLE",
    title: "Advogado trabalhista",
    body: `Negócio: advogado trabalhista que quer contato de quem precisa de orientação sobre rescisão.

Buscas mais próximas da contratação:

- advogado trabalhista
- advogado trabalhista em belém
- advogado para rescisão trabalhista

Buscas predominantemente informacionais:

- o que é rescisão trabalhista
- direitos trabalhistas
- como calcular rescisão

A busca informacional não é ruim. Ela pode servir a um conteúdo, um vídeo ou uma página de explicação.

Ela só pode não merecer o orçamento de uma campanha cujo objetivo agora é gerar contato.`,
  }),
  heading(5, "intencao-antes-do-volume", "Intenção antes de volume"),
  block(6, "intencao-nao-e-nota", true, false, {
    type: "TEXT",
    body: `Volume, CPC e conversão só existem com dados da conta ou de uma fonte que você consultou. Esta aula não inventa esses números.

O que dá para decidir agora é a intenção.

Use uma classificação simples de planejamento, não uma nota científica:

Alta. A busca está muito próxima da ação que a campanha quer.

Média. A busca é relevante, mas ainda cabe mais de uma interpretação.

Baixa. A busca está distante da ação comercial desejada.

Incompatível. A busca não combina com esta campanha.

A mesma palavra muda de classe quando o objetivo muda.`,
  }),
  block(7, "exemplo-curso-trafego", true, false, {
    type: "EXAMPLE",
    title: "Curso de tráfego pago",
    body: `Se a oferta é um curso, estas buscas estão mais perto da matrícula:

- curso de tráfego pago
- curso google ads
- aprender google ads

Estas outras pedem outra resposta:

- o que é tráfego pago
- tráfego pago significado
- salário gestor de tráfego
- vaga gestor de tráfego

“Curso” aqui faz parte da oferta. Para quem vende gestão de anúncios, a mesma palavra pode indicar alguém que quer estudar, não contratar.

O contexto da campanha decide. Não existe uma lista universal de palavras proibidas.`,
  }),
  block(8, "checkpoint-intencao", true, true, {
    type: "CHECKPOINT",
    question: "Uma busca informacional, numa campanha feita para gerar contato agora, deve ser tratada como o quê?",
    options: [
      { id: "sempre-ruim", label: "Como uma busca ruim, que nunca pode existir em nenhum canal." },
      { id: "talvez-fora-do-orcamento", label: "Como uma busca que pode não merecer este orçamento, mesmo sendo um assunto legítimo." },
      { id: "sempre-comprar", label: "Como prova de que a pessoa vai contratar." },
    ],
    correctOptionId: "talvez-fora-do-orcamento",
    explanation: "Informação e compra respondem a momentos diferentes. A busca pode ser útil em outro formato e ainda assim ficar de fora desta campanha.",
  }),
  heading(9, "oferta-e-grupo", "A busca precisa caber na oferta e no grupo"),
  block(10, "um-grupo-uma-mensagem", true, false, {
    type: "TEXT",
    body: `Cada grupo de anúncios da aula anterior tem um tema e uma intenção.

A palavra-chave entra nesse grupo quando a busca pode receber a mesma mensagem e o mesmo destino.

Perguntas práticas:

Essa busca indica que a pessoa procura aquilo que você oferece?

Ela está perto da conversão que você definiu?

Esse termo merece orçamento agora?

Se a resposta for não, a palavra pode esperar ou virar uma negativa. Ela não precisa entrar só porque alguém já pesquisou o assunto.`,
  }),
  block(11, "exemplo-grupo-errado", true, false, {
    type: "EXAMPLE",
    title: "Tema e busca desalinhados",
    body: `Grupo: ultrassom obstétrico.

Busca coerente: ultrassom obstétrico em belém.

Busca de outro tema: ultrassom de tireoide.

As duas têm a palavra ultrassom. Só a primeira combina com o grupo e com o anúncio que ele vai receber.

Juntar temas diferentes no mesmo grupo obriga um anúncio a falar de coisas distintas.`,
  }),
  block(12, "checkpoint-grupo", true, true, {
    type: "CHECKPOINT",
    question: "Quando uma busca deve ficar no mesmo grupo de anúncios?",
    options: [
      { id: "mesma-mensagem", label: "Quando ela pode receber a mesma mensagem e o mesmo destino daquele tema." },
      { id: "qualquer-palavra", label: "Quando ela compartilha qualquer palavra com o nome da campanha." },
      { id: "maior-volume", label: "Quando ela parece ter mais volume, mesmo que o assunto seja outro." },
    ],
    correctOptionId: "mesma-mensagem",
    explanation: "O grupo existe para manter tema, busca, anúncio e destino alinhados.",
  }),
  heading(13, "ampla-frase-exata", "Ampla, frase e exata"),
  block(14, "correspondencias-atuais", true, false, {
    type: "TEXT",
    body: `O Google Ads usa três tipos de correspondência: ampla, de frase e exata.

Nenhum deles significa controle literal absoluto.

Os três podem alcançar variações próximas, incluindo termos relacionados, de acordo com as regras atuais da plataforma.

Correspondência exata não garante que só a frase idêntica, letra por letra, vá disparar o anúncio.

Correspondência de frase também não se limita à ordem exata das palavras como em um manual antigo.

O tipo de correspondência muda o quanto a plataforma pode se afastar da regra que você escreveu. Ele não substitui a escolha da intenção.`,
  }),
  block(15, "nao-comece-sempre-amplo", true, false, {
    type: "CALLOUT",
    tone: "warning",
    title: "Não comece sempre amplo e não use só a exata",
    body: `“Comece sempre com correspondência ampla” e “use apenas correspondência exata” são atalhos ruins para quem está começando.

Quanto menor o orçamento e menor a quantidade de dados, mais importante é começar de um jeito que você consiga acompanhar.

Frase e exata costumam ser pontos de partida úteis nesse cenário.

A correspondência ampla pode fazer sentido quando há mensuração confiável, dados suficientes, objetivo claro, rotina para ler os termos de pesquisa e uma estratégia de lance compatível.

Isso não é uma regra para toda conta.`,
  }),
  block(16, "orcamento-pequeno-concentra", true, false, {
    type: "TEXT",
    body: `Orçamento pequeno pede concentração.

Uma lista enorme, com termos genéricos e correspondência muito aberta, gasta o dia inteiro antes de você entender quem chegou.

Comece enxuto. Três buscas bem escolhidas por grupo já dão uma hipótese. Quinze é um teto inicial razoável, não uma meta.

Você poderá ampliar depois, com termos de pesquisa reais.

A lista de hoje não precisa ser perfeita. Ela precisa ser revisável.`,
  }),
  block(17, "checkpoint-correspondencia", true, true, {
    type: "CHECKPOINT",
    question: "O que a correspondência exata garante hoje?",
    options: [
      { id: "literal-absoluta", label: "Que o anúncio só aparece se a pessoa digitar exatamente aquelas palavras, naquela ordem." },
      { id: "mais-proxima", label: "Uma regra mais próxima da busca escrita, ainda sujeita a variações da plataforma." },
      { id: "mais-volume", label: "O maior volume possível da conta." },
    ],
    correctOptionId: "mais-proxima",
    explanation: "Exata, frase e ampla podem alcançar variações. A exata apenas parte de uma regra mais fechada. Ela não é literalidade absoluta.",
  }),
  heading(18, "negativas", "O que você não quer pagar"),
  block(19, "negativa-de-campanha-ou-grupo", true, false, {
    type: "TEXT",
    body: `Palavra-chave negativa é uma regra para reduzir pesquisas incompatíveis com a campanha.

Ela pode valer para a campanha inteira ou só para um grupo.

Negativa de campanha: a incompatibilidade vale para todos os grupos. Exemplo: alguém que procura emprego, quando nenhum grupo oferece vaga.

Negativa de grupo: a incompatibilidade vale para um tema. Outro grupo da mesma campanha ainda pode usar aquela busca.

“Vaga”, “emprego”, “salário”, “grátis”, “pdf” e “download” aparecem com frequência como incompatíveis. Eles não formam uma lista pronta para colar em toda conta.

“Curso” seria negativa para quem vende só o serviço de gestão. Não deve ser negativa para quem vende um curso.

O contexto decide.`,
  }),
  block(20, "exemplo-curso-nao-e-universal", true, false, {
    type: "EXAMPLE",
    title: "A mesma palavra, duas campanhas",
    body: `Campanha de gestão de tráfego: a busca “curso de tráfego pago” pede aula, não a contratação do serviço. “Curso” pode entrar como negativa.

Campanha do próprio curso: “curso de tráfego pago” é uma das buscas mais próximas da matrícula. Negativar “curso” afastaria o cliente certo.

Copiar a negativa de outro negócio, sem olhar a oferta, cria o problema inverso.`,
  }),
  heading(21, "marca-e-concorrente", "Marca, termo genérico e concorrente"),
  block(22, "tres-tipos-de-busca", true, false, {
    type: "TEXT",
    body: `Separe três famílias.

Busca da própria marca. Alguém procura o seu nome. A intenção costuma ser mais direta, e o anúncio precisa confirmar que a pessoa chegou ao lugar certo.

Busca genérica. Alguém procura o serviço ou o produto, sem citar uma empresa. É aqui que a oferta e a localização precisam estar claras.

Busca de concorrente. Alguém procura outro nome. Não anuncie o nome de um concorrente por padrão.

Antes disso, avalie intenção, política da plataforma, a mensagem que você teria coragem de usar, o custo e a estratégia. Sem essa avaliação, o clique pode chegar caro e desalinhado.`,
  }),
  block(23, "local-plural-redundancia", true, false, {
    type: "TEXT",
    body: `Localização entra na palavra-chave quando ela muda quem você quer atender.

“Advogado trabalhista” e “advogado trabalhista em belém” não dizem a mesma coisa se a campanha só atende uma cidade.

Plural, acento e uma palavra a mais nem sempre merecem linhas duplicadas. A plataforma já alcança parte dessas variações.

Não reescreva a busca da pessoa só para “padronizar”. Se duas frases mudam a intenção, mantenha as duas. Se mudam só a grafia óbvia, uma delas pode bastar no começo.

O Planejador de palavras-chave ajuda a enxergar ideias. Ele não é a verdade da sua campanha e não substitui a decisão de intenção. Você pode trazer ideias de lá manualmente. Esta aula não conecta a conta nem estima volume ou CPC.`,
  }),
  block(24, "planejador-nao-e-verdade", true, false, {
    type: "CALLOUT",
    tone: "tip",
    title: "O Planejador apoia. Ele não decide.",
    body: `Use o Planejador para descobrir formas como as pessoas falam do assunto.

Depois classifique cada ideia: usar agora, testar depois ou excluir.

Quando a campanha estiver no ar, os termos de pesquisa passam a ser a fonte mais concreta. Eles mostram o que foi digitado, não o que o planejamento imaginou.`,
  }),
  block(25, "lista-revisavel", true, false, {
    type: "TEXT",
    body: `Termos que parecem bons ainda podem atrair a intenção errada.

“Advogado trabalhista grátis”, “modelo de rescisão pdf” e “vaga para advogado” usam palavras do seu tema e pedem outra coisa: gratuidade, um arquivo ou um emprego.

Marque esses casos como excluir ou como negativa, conforme o escopo.

A lista inicial fica pronta para a próxima etapa, os anúncios, quando cada grupo ativo tem buscas que você aceita pagar agora e você consegue explicar por quê.

Se ainda houver buraco, o resultado honesto é refinar a lista. Não finja que está pronta.`,
  }),
  block(26, "atividade-busca-que-nao-paga", true, true, {
    type: "ACTIVITY",
    prompt: "Escreva uma busca do seu tema que você não quer pagar para receber nesta campanha, e diga por quê.",
    inputType: "long_text",
    placeholder: "A busca e o motivo de ficar de fora",
  }),
  block(27, "checklist-antes-da-lista", true, true, {
    type: "CHECKLIST",
    items: [
      { id: "oferta-clara", label: "Sei qual oferta esta campanha promove." },
      { id: "grupos-separados", label: "Cada grupo tem um tema que cabe em um anúncio." },
      { id: "intencao-antes-volume", label: "Classifiquei as buscas pela intenção, sem inventar volume ou CPC." },
      { id: "negativas-no-contexto", label: "Pensei nas negativas a partir desta oferta, não de uma lista copiada." },
    ],
  }),
  heading(28, "plano-de-palavras", "Monte a lista do seu negócio"),
  block(29, "plano-palavras-chave", true, true, {
    type: "TOOL",
    toolKey: "KEYWORD_INTENT_PLAN_V1",
    title: "Plano inicial de palavras-chave",
    description: `Organize, por grupo, as buscas que você quer usar, testar depois ou excluir.

Se o Blueprint da campanha de Pesquisa já existir neste projeto, nome, oferta e grupos entram preenchidos.

Se ainda não existir, a ferramenta pede só o contexto mínimo. A aula anterior continua recomendada, mas não é uma trava.

Comece enxuto. Você poderá ampliar depois com os termos de pesquisa reais.

A ferramenta não cria uma lista no seu lugar.`,
  }),
  block(30, "checkpoint-lista-curta", true, true, {
    type: "CHECKPOINT",
    question: "Qual é o papel da primeira lista de palavras-chave?",
    options: [
      { id: "cobrir-tudo", label: "Alcançar todas as pessoas que possam pesquisar o assunto." },
      { id: "hipotese-curta", label: "Ser uma hipótese curta, coerente com a oferta, e revisável quando os termos reais aparecerem." },
      { id: "copiar-planejador", label: "Copiar o Planejador inteiro para não deixar busca de fora." },
    ],
    correctOptionId: "hipotese-curta",
    explanation: "Mais palavras não significam uma campanha melhor. A lista inicial escolhe poucas buscas que combinam com o que você oferece.",
  }),
  block(31, "conclusao-lista-curta", true, false, {
    type: "CONCLUSION",
    body: "Uma boa lista de palavras-chave não tenta alcançar todo mundo. Ela ajuda sua campanha a aparecer para buscas que combinam com aquilo que você realmente oferece.",
  }),
  block(32, "termos-reais-depois", true, false, {
    type: "TEXT",
    body: `Depois que a campanha rodar, volte aos termos de pesquisa.

Eles mostram a diferença entre a regra que você configurou e a busca que a pessoa fez.

Uma busca nova e compatível pode entrar. Uma busca incompatível vira negativa no escopo certo.

Esse ciclo importa mais do que aumentar a lista no primeiro dia.`,
  }),
  block(33, "exemplo-tres-decisoes", true, false, {
    type: "EXAMPLE",
    title: "Três decisões no mesmo grupo",
    body: `Grupo: rescisão trabalhista.

Usar agora, frase: advogado para rescisão trabalhista.

Testar depois, exata: cálculo de rescisão com advogado. A intenção existe, mas ainda mistura a vontade de calcular sozinho com a vontade de contratar.

Excluir: modelo de rescisão pdf. A pessoa quer um arquivo, não o contato com o escritório.

Nenhuma das três precisa de volume estimado para ser classificada.`,
  }),
  block(34, "aviso-proximos-anuncios", true, false, {
    type: "CALLOUT",
    tone: "info",
    title: "Os anúncios vêm depois da lista",
    body: `Quando a lista estiver coerente, o próximo passo é escrever anúncios que respondam a essas buscas e levem ao destino que você já escolheu.

Se a lista ainda tiver grupo sem busca, conflito ou uma pendência que você mesmo registrou, o resultado pode ficar como refinamento. Isso é uma conclusão válida.

A aula dos anúncios só deve ser aberta quando o conteúdo dela estiver pronto. Até lá, siga com a lista que você consegue defender.`,
  }),
];
