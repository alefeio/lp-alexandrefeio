import type { LessonBlockData } from "@/lib/learning/blocks";

export const LESSON_02_SLUG = "google-ads-ou-meta-ads";

export const lesson02Meta = {
  title: "Google Ads ou Meta Ads: qual escolher?",
  summary:
    "Entenda em quais situações Google Ads e Meta Ads tendem a funcionar melhor e escolha um ponto de partida mais coerente com o comportamento do seu cliente e a sua oferta.",
  publicPreview:
    "Google Ads e Meta Ads podem gerar oportunidades, mas fazem isso de maneiras diferentes. Nesta aula você vai aprender a analisar o comportamento do seu cliente e chegar a uma indicação inicial de canal para o seu negócio.",
  estimatedMinutes: 25,
  accessType: "FREE" as const,
  priceCents: null,
  commerceStatus: "NOT_FOR_SALE" as const,
};

export type Lesson02Block = {
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
): Lesson02Block {
  return { position, blockKey, countsForProgress, required, data };
}

const heading = (position: number, blockKey: string, text: string) =>
  block(position, blockKey, false, false, { type: "HEADING", level: 2, text });

export const lesson02Blocks: Lesson02Block[] = [
  heading(1, "qual-canal-e-melhor", "Qual canal é melhor?"),
  block(2, "pergunta-certa-sobre-canal", true, false, {
    type: "TEXT",
    body: `Uma das primeiras perguntas de quem começa no tráfego pago é:

“É melhor anunciar no Google ou no Instagram?”

A pergunta parece simples, mas está incompleta.

Google Ads e Meta Ads podem levar pessoas até uma empresa, gerar contatos e contribuir para vendas.

A diferença está principalmente em como essas pessoas podem ser alcançadas e em que momento a mensagem aparece.

Por isso, em vez de perguntar:

“Qual plataforma é melhor?”

é mais útil perguntar:

“Em qual situação meu cliente está quando eu quero alcançá-lo?”

Essa mudança de pergunta melhora muito a decisão.`,
  }),
  block(3, "escopo-comparacao-google-meta", true, false, {
    type: "CALLOUT",
    tone: "info",
    title: "Uma simplificação útil — mas não absoluta",
    body: `Nesta aula, vamos comparar principalmente Google Ads em situações de busca e Meta Ads em situações de descoberta e interesse.

As duas plataformas fazem muito mais do que isso.

O objetivo aqui não é ensinar todos os formatos disponíveis, mas ajudá-lo a escolher um ponto de partida.`,
  }),
  heading(4, "quando-google-faz-sentido", "Quando Google Ads tende a fazer sentido"),
  block(5, "demanda-ativa-google", true, false, {
    type: "TEXT",
    body: `Imagine uma pessoa que abre o Google e pesquisa:

“dentista infantil em Belém”

“empresa de energia solar”

“advogado trabalhista”

“conserto de notebook perto de mim”

Existe algo importante acontecendo nesses exemplos:

a pessoa tomou a iniciativa de procurar uma solução.

Chamamos isso, de maneira simplificada, de demanda ativa.

Quando existe uma quantidade relevante de pessoas procurando por aquilo que sua empresa oferece, campanhas de Pesquisa do Google Ads podem ser um ponto de partida bastante interessante.

A empresa consegue aparecer justamente quando existe uma intenção expressa na busca.

Mas isso não significa que toda pesquisa tenha intenção de compra.

Compare:

“como funciona energia solar”

com:

“empresa instalação energia solar Belém”

As duas pesquisas falam do mesmo assunto, mas representam momentos bastante diferentes.

Por isso, trabalhar com Google Ads não é apenas encontrar palavras relacionadas ao seu produto.

É entender a intenção existente por trás dessas pesquisas.`,
  }),
  block(6, "exemplo-chaveiro-google", true, false, {
    type: "EXAMPLE",
    title: "Exemplo: alguém ficou trancado para fora de casa",
    body: `Imagine uma pessoa que perdeu a chave e precisa entrar em casa.

Ela pega o celular e pesquisa:

“chaveiro 24 horas perto de mim”

Nesse momento:

- existe um problema claro;
- existe urgência;
- a pessoa já procura uma solução;
- ela provavelmente está disposta a entrar em contato rapidamente.

Nesse cenário, aparecer no momento da pesquisa pode ser extremamente relevante.

Uma campanha de Pesquisa no Google tende a fazer mais sentido como primeiro teste do que depender apenas de a pessoa encontrar casualmente um anúncio enquanto navega por uma rede social.`,
  }),
  block(7, "checkpoint-demanda-ativa", true, true, {
    type: "CHECKPOINT",
    question: "Qual situação abaixo apresenta o sinal mais claro de demanda ativa?",
    options: [
      { id: "produto-desconhecido", label: "A. Uma pessoa vê no Instagram um produto que nunca conhecia." },
      { id: "pesquisa-ultrassom", label: "B. Uma pessoa pesquisa “clínica de ultrassom perto de mim”." },
      { id: "video-entretenimento", label: "C. Uma pessoa assiste a um vídeo de entretenimento." },
      { id: "segue-identidade", label: "D. Uma pessoa segue uma loja porque gostou da identidade visual." },
    ],
    correctOptionId: "pesquisa-ultrassom",
    explanation:
      "A pesquisa revela que a pessoa tomou a iniciativa de procurar uma solução. Isso não garante a compra, mas demonstra uma intenção mais explícita naquele momento.",
  }),
  heading(8, "quando-meta-faz-sentido", "Quando Meta Ads tende a fazer sentido"),
  block(9, "descoberta-meta", true, false, {
    type: "TEXT",
    body: `Agora imagine outra situação.

A pessoa não abriu uma plataforma procurando pelo seu produto.

Ela está:

- vendo Stories;
- navegando pelo Instagram;
- olhando o feed;
- assistindo a um Reels;
- utilizando Facebook.

Nesse momento, um anúncio pode apresentar uma oferta que desperta interesse mesmo sem existir uma pesquisa naquele instante.

É um comportamento diferente.

Meta Ads pode ser especialmente interessante quando:

- a oferta chama atenção visualmente;
- existe espaço para demonstrar o produto;
- o cliente ainda não sabe que quer aquilo;
- a empresa precisa gerar descoberta;
- o público pode ser alcançado por características, interesses ou comportamento;
- criativos conseguem comunicar rapidamente o benefício.

Isso não significa que todas as pessoas alcançadas são “desinteressadas”.

Uma pessoa pode já conhecer a empresa, ter visitado o site ou interagido anteriormente.

Meta também pode atuar sobre públicos mais próximos da decisão.`,
  }),
  block(10, "exemplo-produto-visual-meta", true, false, {
    type: "EXAMPLE",
    title: "Exemplo: uma nova coleção",
    body: `Imagine uma loja que lançou uma coleção de vestidos para eventos.

Poucas pessoas provavelmente abrirão o Google naquele instante e pesquisarão exatamente pelo nome daquela coleção.

Mas um anúncio visual pode mostrar:

- o vestido;
- como ele veste;
- detalhes do tecido;
- combinações;
- ocasião de uso.

A própria apresentação pode despertar desejo.

Nesse contexto, Meta Ads pode ser um ponto de partida bastante natural.

O anúncio não está apenas capturando uma demanda que já apareceu em forma de pesquisa.

Ele também ajuda a apresentar a oferta.`,
  }),
  block(11, "checkpoint-descoberta-meta", true, true, {
    type: "CHECKPOINT",
    question: "Qual cenário abaixo tende a favorecer mais um primeiro teste de descoberta no Meta Ads?",
    options: [
      { id: "guincho-urgente", label: "A. Uma pessoa procura urgentemente “guincho 24 horas”." },
      { id: "colecao-nova", label: "B. Uma empresa quer apresentar visualmente uma nova coleção que o público ainda não conhece." },
      { id: "nome-da-clinica", label: "C. Uma pessoa pesquisa o nome exato de uma clínica." },
      { id: "assistencia-notebook", label: "D. Uma pessoa procura “assistência técnica notebook perto de mim”." },
    ],
    correctOptionId: "colecao-nova",
    explanation:
      "Quando a própria apresentação visual da oferta ajuda a despertar interesse e ainda não existe necessariamente uma busca ativa por ela, Meta Ads pode ser um bom ponto de partida.",
  }),
  heading(12, "fatores-que-mudam-decisao", "O que realmente muda a decisão"),
  block(13, "seis-fatores-escolha", true, false, {
    type: "TEXT",
    body: `A escolha não deveria depender apenas da plataforma que você gosta mais.

Observe pelo menos seis fatores.

1. O cliente já procura essa solução?

Se as pessoas procuram ativamente pelo produto ou serviço, existe uma oportunidade clara de capturar essa intenção.

2. A oferta precisa ser descoberta?

Alguns produtos despertam interesse quando são apresentados.

A pessoa não necessariamente estava procurando por eles minutos antes.

3. A oferta é visual?

Moda, decoração, estética, gastronomia, turismo e muitos produtos físicos podem se beneficiar bastante de demonstração visual.

Mas “ser visual” não significa automaticamente que Meta será o único canal adequado.

4. Existe urgência?

Problemas urgentes frequentemente levam a uma pesquisa imediata.

Isso pode favorecer canais capazes de capturar aquela intenção naquele momento.

5. Sua empresa consegue produzir bons criativos?

Meta depende bastante da capacidade de apresentar a oferta de maneira interessante.

Se a empresa não consegue produzir imagens, vídeos ou mensagens minimamente convincentes, isso influencia a execução.

6. O que acontece depois do clique?

Não adianta escolher corretamente a plataforma se:

- a página é ruim;
- o WhatsApp não responde;
- a oferta não está clara;
- a conversão não é medida.

A escolha do canal é apenas uma parte da estrutura.`,
  }),
  block(14, "orcamento-nao-escolhe-canal", true, false, {
    type: "CALLOUT",
    tone: "info",
    title: "“Qual é mais barato?” não é a primeira pergunta",
    body: `Um clique mais barato não significa necessariamente um cliente mais barato.

Um canal pode gerar cliques de menor custo e mesmo assim produzir poucas oportunidades.

Outro pode ter cliques mais caros, mas alcançar pessoas com intenção mais forte.

Compare resultado comercial, não apenas custo de clique.`,
  }),
  heading(15, "quando-usar-os-dois", "Quando os dois podem fazer sentido"),
  block(16, "google-meta-complementares", true, false, {
    type: "TEXT",
    body: `Google Ads e Meta Ads não precisam competir pelo direito de existir na mesma estratégia.

Eles podem desempenhar papéis diferentes.

Imagine este caminho:

Uma pessoa conhece uma empresa através de um anúncio no Instagram.

Alguns dias depois, precisa do serviço.

Ela pesquisa no Google pelo serviço ou pelo nome da empresa.

Depois visita o site e entra em contato.

Nesse caso, tentar atribuir todo o resultado a apenas uma plataforma pode esconder a jornada real.

Também pode acontecer o inverso.

Alguém encontra a empresa no Google, visita a página, mas ainda não entra em contato.

Mais tarde, pode ser impactado novamente por uma campanha em outra plataforma.

Por isso, negócios mais maduros frequentemente trabalham com mais de um canal.

Mas isso não significa que um iniciante precisa dividir imediatamente um orçamento pequeno entre várias plataformas.

Às vezes, escolher um canal para o primeiro teste gera aprendizado mais claro.`,
  }),
  block(17, "exemplo-clinica-google-meta", true, false, {
    type: "EXAMPLE",
    title: "Exemplo: uma clínica pode usar os dois",
    body: `Imagine uma clínica de ultrassonografia.

No Google:

uma pessoa pode pesquisar diretamente por:

“ultrassom obstétrico”

“ultrassonografia morfológica”

“clínica de ultrassom perto de mim”

Existe demanda ativa que pode ser capturada.

No Meta:

a clínica pode trabalhar conteúdos e campanhas que apresentem:

- diferenciais;
- estrutura;
- profissionais;
- exames;
- orientações;
- informações relevantes para pacientes.

Um canal pode capturar intenção existente.

O outro pode ampliar conhecimento, relacionamento e descoberta.

Qual deles deve receber o primeiro investimento depende da situação real da clínica.`,
  }),
  block(18, "checkpoint-canais-complementares", true, true, {
    type: "CHECKPOINT",
    question: "Qual afirmação descreve melhor a relação entre Google Ads e Meta Ads?",
    options: [
      { id: "um-para-sempre", label: "A. Uma empresa precisa escolher apenas um deles para sempre." },
      { id: "meta-antes", label: "B. Meta Ads sempre deve ser usado antes do Google." },
      { id: "google-servicos", label: "C. Google Ads sempre é melhor para serviços." },
      { id: "papeis-diferentes", label: "D. Eles podem cumprir papéis diferentes e até participar da mesma jornada de compra." },
    ],
    correctOptionId: "papeis-diferentes",
    explanation:
      "Os canais podem atuar em momentos diferentes. Uma empresa pode começar por um deles e posteriormente usar os dois de forma complementar.",
  }),
  heading(19, "erros-escolha-canal", "Quatro erros comuns ao escolher o canal"),
  block(20, "erros-comuns-google-meta", true, false, {
    type: "TEXT",
    body: `Erro 1 — Escolher porque “todo mundo anuncia lá”

Popularidade não substitui estratégia.

O canal precisa fazer sentido para o seu cliente e para sua oferta.

Erro 2 — Escolher apenas pelo custo do clique

CPC é uma métrica.

Não é o resultado final do negócio.

Erro 3 — Dividir um orçamento pequeno demais entre tudo

Estar em todas as plataformas não significa ter uma estratégia melhor.

Às vezes isso apenas reduz a quantidade de dados obtida em cada canal.

Erro 4 — Culpar a plataforma por problemas que acontecem depois do clique

Se o anúncio funciona, mas:

- a página não convence;
- o atendimento demora;
- o produto não está claro;

trocar Google por Meta ou Meta por Google talvez não resolva o problema.`,
  }),
  block(21, "checklist-indicios-canal", false, false, {
    type: "CHECKLIST",
    items: [
      { id: "procura-ativa", label: "Meus clientes costumam procurar ativamente pelo que vendo." },
      { id: "interesse-visual", label: "Minha oferta consegue despertar interesse quando é apresentada visualmente." },
      { id: "ha-urgencia", label: "Existe urgência em parte das compras." },
      { id: "consigo-criativos", label: "Consigo produzir bons materiais visuais." },
      { id: "sei-o-destino", label: "Sei para onde enviarei quem clicar." },
      { id: "acao-clara", label: "Tenho uma ação clara que quero gerar." },
    ],
  }),
  heading(22, "atividade-escolha-inicial", "Faça sua escolha inicial"),
  block(23, "atividade-cenario-canal", true, true, {
    type: "ACTIVITY",
    inputType: "long_text",
    prompt: `Como seu cliente chega até você?

Responda pensando no produto ou serviço que você pretende divulgar primeiro.

1. Seu cliente costuma procurar ativamente por esse tipo de produto ou serviço? Dê um exemplo de como ele poderia pesquisar.

2. Sua oferta pode despertar interesse mesmo em alguém que não estava procurando por ela naquele momento? Por quê?

3. Mostrar visualmente o produto, serviço, resultado, ambiente ou experiência ajuda bastante a convencer o cliente?

4. Existe urgência na decisão de compra ou normalmente ela pode esperar?

5. Sua empresa consegue produzir imagens, vídeos ou outros criativos com frequência razoável?

6. Considerando as respostas acima, qual canal parece mais coerente para o primeiro teste: Google Ads, Meta Ads, ambos ou ainda não sei?

Não procure acertar uma resposta “oficial”.

O objetivo é justificar sua escolha.`,
  }),
  block(24, "resultado-indicacao-canal", true, true, {
    type: "RESULT",
    title: "Minha indicação inicial de canal",
    prompt: `Registre a indicação inicial desta aula.

No campo do canal, use uma destas opções: Google Ads, Meta Ads, Google Ads + Meta Ads ou Ainda não tenho informação suficiente.

Esta é uma indicação inicial baseada nas suas próprias respostas, não uma regra definitiva. O diagnóstico da próxima aula analisará outros aspectos da prontidão do negócio antes de você investir.`,
    fields: [
      { key: "cenario-demanda", label: "Meu cenário de demanda" },
      { key: "indicacao-inicial", label: "Minha indicação inicial" },
      { key: "motivo-escolha", label: "Principal motivo da minha escolha" },
      { key: "validacao-antes", label: "O que preciso validar antes de investir" },
      { key: "segundo-canal", label: "Quando o outro canal pode fazer sentido" },
    ],
  }),
  heading(25, "o-que-levar-aula-02", "O que você deve levar desta aula"),
  block(26, "resumo-google-meta", true, false, {
    type: "TEXT",
    body: `Guarde estas cinco ideias.

1. Nenhuma plataforma é universalmente melhor.

A escolha depende do negócio, oferta e comportamento do cliente.

2. Demanda ativa é um sinal importante para Google Ads.

Quando alguém já procura uma solução, campanhas de Pesquisa podem colocar a empresa diante dessa intenção.

3. Meta Ads pode ser muito eficiente para descoberta.

Uma oferta pode gerar interesse mesmo antes de existir uma pesquisa explícita.

4. Custo de clique não decide sozinho.

O que importa é a relação entre investimento e resultado comercial.

5. Os canais podem trabalhar juntos.

Começar por um não significa abandonar o outro para sempre.

A decisão inicial serve para concentrar aprendizado.`,
  }),
  block(27, "checkpoint-final-escolha-canal", true, true, {
    type: "CHECKPOINT",
    question:
      "Uma empresa percebe que seus clientes procuram ativamente pelo serviço no Google, mas também possui uma oferta muito visual que pode despertar interesse no Instagram. Qual conclusão é mais adequada?",
    options: [
      { id: "apenas-google", label: "A. Precisa obrigatoriamente escolher apenas Google Ads." },
      { id: "apenas-meta", label: "B. Precisa obrigatoriamente escolher apenas Meta Ads." },
      {
        id: "ambos-com-criterio",
        label:
          "C. Os dois canais podem fazer sentido, e a empresa pode decidir qual testar primeiro com base no objetivo, orçamento e estrutura disponível.",
      },
      { id: "clique-mais-barato", label: "D. Deve escolher apenas o canal que tiver o clique mais barato." },
    ],
    correctOptionId: "ambos-com-criterio",
    explanation:
      "Os sinais indicam oportunidades nos dois canais. A decisão inicial pode considerar onde existe uma hipótese mais forte e capacidade suficiente para testar e medir o resultado.",
  }),
  block(28, "conclusao-aula-02", true, false, {
    type: "CONCLUSION",
    body: `Você já consegue escolher com mais critério

Agora a pergunta deixou de ser:

“Google ou Instagram: qual é melhor?”

e passou a ser:

“Qual canal combina melhor com a forma como meu cliente encontra ou descobre minha oferta?”

Essa mudança é importante.

Você já analisou:

- demanda ativa;
- descoberta;
- força visual;
- urgência;
- capacidade de produzir criativos;
- complementaridade entre canais.

E registrou sua indicação inicial.

Mas ainda existe uma pergunta anterior a qualquer campanha:

“Meu negócio está realmente preparado para anunciar?”

Ter um canal escolhido não significa que toda a estrutura esteja pronta.

Na próxima aula, você fará o Diagnóstico de Prontidão para Tráfego e descobrirá quais pontos precisam de atenção antes de aumentar o investimento.

Próxima recomendação:

Aula 3 — Seu negócio está pronto para anunciar?`,
  }),
];
