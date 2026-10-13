import type { LessonBlockData } from "@/lib/learning/blocks";

export const LESSON_01_SLUG = "como-funciona-o-trafego-pago";

export const lesson01Meta = {
  title: "Como funciona o tráfego pago e quando ele faz sentido",
  summary:
    "Entenda como o tráfego pago funciona na prática, o que acontece entre o anúncio e o resultado e em quais situações anunciar realmente faz sentido para um negócio.",
  publicPreview:
    "Tráfego pago não é simplesmente “pagar para aparecer”. Nesta aula você vai entender o caminho completo de uma campanha e construir seu primeiro mapa de tráfego aplicado ao seu negócio.",
  estimatedMinutes: 25,
  accessType: "FREE" as const,
  priceCents: null,
  commerceStatus: "NOT_FOR_SALE" as const,
};

export type Lesson01Block = {
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
): Lesson01Block {
  return { position, blockKey, countsForProgress, required, data };
}

const heading = (position: number, blockKey: string, text: string) =>
  block(position, blockKey, false, false, { type: "HEADING", level: 2, text });

export const lesson01Blocks: Lesson01Block[] = [
  heading(1, "entendendo-trafego-pago", "Entendendo o tráfego pago"),
  block(2, "trafego-pago-nao-e-so-anunciar", true, false, {
    type: "TEXT",
    body: `Tráfego pago é o uso de plataformas de publicidade para colocar uma oferta diante de pessoas que podem ter interesse nela.

Isso parece simples, mas existe uma diferença importante entre comprar tráfego e gerar resultado.

Quando você anuncia no Google, Instagram, Facebook ou outra plataforma, o que está comprando primeiro é uma oportunidade de exposição, clique, visita ou interação. O resultado comercial só acontece depois, quando todo o restante do caminho funciona.

Uma campanha pode gerar muitos cliques e mesmo assim não gerar clientes.

Por isso, pensar apenas no anúncio é um dos erros mais comuns de quem começa.

O tráfego pago funciona melhor quando existe um caminho claro:

pessoa certa → anúncio → destino → ação → acompanhamento do resultado

O anúncio é apenas uma parte desse caminho.`,
  }),
  block(3, "regra-fundamental-trafego", true, false, {
    type: "CALLOUT",
    tone: "info",
    title: "Uma regra para guardar",
    body: `Tráfego pago não cria automaticamente uma boa oferta, uma boa página ou um bom atendimento. Ele acelera a chegada de pessoas ao que você já preparou.

Se existe uma estrutura boa, o tráfego pode ampliá-la.

Se existe um problema, o tráfego também pode ampliar esse problema.`,
  }),
  heading(4, "como-campanha-funciona", "O caminho de uma campanha"),
  block(5, "cinco-partes-trafego", true, false, {
    type: "TEXT",
    body: `Para entender uma campanha sem complicação, pense em cinco partes.

1. Objetivo

Primeiro você precisa saber o que deseja que aconteça.

Por exemplo:

- receber contatos;
- vender um produto;
- receber mensagens no WhatsApp;
- gerar agendamentos;
- levar pessoas a uma loja;
- divulgar uma nova oferta.

“Quero anunciar” não é um objetivo.

“Quero receber pedidos de orçamento pelo WhatsApp” é muito mais próximo de um objetivo útil.

2. Oferta

É aquilo que será apresentado.

Pode ser:

- uma consulta;
- um serviço;
- um produto;
- uma promoção;
- uma matrícula;
- um orçamento;
- uma condição especial.

Quando a empresa tenta anunciar “tudo o que faz” de uma só vez, a mensagem tende a ficar fraca.

3. Anúncio

É o ponto de contato entre a empresa e o público.

Ele pode aparecer, por exemplo, quando alguém pesquisa no Google ou enquanto uma pessoa navega pelo Instagram.

O anúncio precisa gerar interesse suficiente para a pessoa dar o próximo passo.

4. Destino

Depois do clique, a pessoa precisa chegar a algum lugar.

Pode ser:

- uma landing page;
- um site;
- o WhatsApp;
- uma página de produto;
- um perfil;
- outro ambiente de conversão.

O destino precisa continuar a conversa iniciada pelo anúncio.

5. Conversão

É a ação que realmente importa para aquele objetivo.

Por exemplo:

clique no anúncio não é necessariamente uma conversão.

pedido de orçamento pode ser.

visualização do Instagram pode não ser.

agendamento concluído pode ser.

Essa distinção é essencial porque tráfego pago só começa a fazer sentido como ferramenta de negócio quando você sabe o que deseja medir.`,
  }),
  block(6, "exemplo-clinica", true, false, {
    type: "EXAMPLE",
    title: "Exemplo: uma clínica",
    body: `Imagine uma clínica que quer aumentar os agendamentos de ultrassonografia.

Uma estrutura possível seria:

Objetivo: receber solicitações de agendamento.

Oferta: ultrassonografia obstétrica.

Anúncio: apresentação do serviço para pessoas com intenção ou perfil compatível.

Destino: página com informações do exame e botão de WhatsApp.

Conversão: pessoa inicia um contato qualificado para agendamento.

Perceba que o anúncio sozinho não resolve tudo.

Se a página não explica bem o serviço, o anúncio perde força.

Se o WhatsApp demora horas para responder, existe outro gargalo.

Se ninguém mede quantos contatos realmente vieram da campanha, fica difícil saber se o investimento funcionou.`,
  }),
  block(7, "checkpoint-clique-conversao", true, true, {
    type: "CHECKPOINT",
    question: "Uma campanha recebeu 100 cliques. Isso significa que ela gerou 100 conversões?",
    options: [
      { id: "todo-clique-e-conversao", label: "A. Sim. Todo clique é uma conversão." },
      { id: "clique-e-conversao-diferem", label: "B. Não. Clique e conversão são coisas diferentes." },
      { id: "anuncio-pago-basta", label: "C. Sim, desde que o anúncio tenha sido pago." },
      { id: "depende-do-investimento", label: "D. Depende apenas do valor investido." },
    ],
    correctOptionId: "clique-e-conversao-diferem",
    explanation:
      "O clique indica que alguém interagiu com o anúncio. A conversão representa a ação que foi definida como resultado relevante, como solicitar orçamento, comprar, agendar ou iniciar um contato qualificado.",
  }),
  heading(8, "de-onde-vem-o-custo", "Por que você paga?"),
  block(9, "leilao-publicidade", true, false, {
    type: "TEXT",
    body: `As principais plataformas de anúncios operam por sistemas de disputa ou leilão.

Isso não significa simplesmente que “quem paga mais aparece”.

Diversos fatores podem participar da decisão, dependendo da plataforma e do tipo de campanha:

- valor da oferta ou lance;
- qualidade e relevância do anúncio;
- probabilidade de a pessoa realizar determinada ação;
- concorrência;
- público;
- contexto;
- posicionamento;
- objetivo escolhido pela campanha.

Por isso duas empresas podem disputar pessoas semelhantes e obter custos diferentes.

Também é por isso que não existe uma tabela universal dizendo:

“Um cliente de tráfego pago custa R$ X.”

O custo depende do mercado, oferta, região, concorrência, canal, objetivo e eficiência de toda a estrutura.`,
  }),
  block(10, "orcamento-nao-e-garantia", true, false, {
    type: "CALLOUT",
    tone: "warning",
    title: "Investimento não é garantia",
    body: `Investir mais pode gerar mais oportunidades de coleta de dados e alcance, mas não garante proporcionalmente mais vendas.

Uma campanha ruim com R$ 1.000 não se transforma automaticamente em boa campanha porque recebeu R$ 2.000.`,
  }),
  heading(11, "quando-faz-sentido", "Quando o tráfego pago faz sentido?"),
  block(12, "cenarios-faz-sentido", true, false, {
    type: "TEXT",
    body: `Tráfego pago tende a ser mais útil quando existe alguma combinação dos fatores abaixo.

Existe algo concreto para oferecer

É muito mais fácil anunciar quando você consegue responder:

“O que exatamente estou oferecendo?”

Quanto mais genérica a resposta, mais difícil tende a ser construir uma campanha clara.

Existe uma ação desejada

Você sabe o que espera que a pessoa faça depois de ver ou clicar no anúncio.

Existe um destino minimamente preparado

Não precisa necessariamente ser uma landing page sofisticada.

Mas a pessoa precisa conseguir:

- entender a oferta;
- encontrar as informações importantes;
- realizar a ação esperada.

Existe capacidade de atender a demanda

Gerar contatos que ninguém responde não resolve o problema.

Existe alguma forma de acompanhar o resultado

Mesmo que a mensuração ainda não seja perfeita, é importante conseguir relacionar investimento e resultado de alguma maneira.

Existe orçamento que pode ser testado sem comprometer o negócio

Tráfego pago envolve aprendizado.

Os primeiros resultados também servem para descobrir o que funciona e o que precisa mudar.

O investimento não deveria depender de uma promessa de retorno imediato para pagar uma conta urgente.`,
  }),
  block(13, "checklist-faz-sentido", false, false, {
    type: "CHECKLIST",
    items: [
      { id: "sei-o-que-divulgar", label: "Sei qual produto ou serviço quero divulgar." },
      { id: "sei-a-acao", label: "Sei qual ação quero que a pessoa realize." },
      { id: "tenho-destino", label: "Tenho algum lugar para enviar quem clicar." },
      { id: "consigo-atender", label: "Consigo atender os contatos que surgirem." },
      { id: "consigo-acompanhar", label: "Tenho uma forma mínima de acompanhar os resultados." },
      { id: "tenho-orcamento", label: "Tenho algum orçamento disponível para teste." },
    ],
  }),
  heading(14, "quando-nao-e-hora", "Quando talvez ainda não seja hora de anunciar"),
  block(15, "cenarios-nao-anunciar", true, false, {
    type: "TEXT",
    body: `Às vezes, a melhor decisão de tráfego pago é não iniciar uma campanha ainda.

Isso pode acontecer quando:

Você não sabe o que quer vender

Se nem a empresa consegue escolher a oferta principal, provavelmente o anúncio também não conseguirá comunicá-la com clareza.

Não existe destino ou atendimento

Imagine pagar por um clique que leva para uma página quebrada, para um WhatsApp sem resposta ou para uma oferta impossível de entender.

O problema não está no tráfego.

A empresa precisa que cada real volte imediatamente

Campanhas precisam de observação, testes e ajustes.

Tráfego pago não deveria ser tratado como uma máquina onde R$ 10 entram hoje e obrigatoriamente R$ 20 saem amanhã.

Você não consegue identificar nenhum resultado

Se não houver qualquer maneira de saber o que aconteceu depois do anúncio, decisões futuras passam a depender de sensação.

O problema real não é falta de pessoas

Uma empresa pode já receber muitos contatos, mas:

- responder mal;
- demorar;
- perder orçamentos;
- ter preço incompatível;
- possuir uma oferta confusa.

Comprar mais tráfego nesse momento pode apenas colocar mais pessoas dentro de um processo que já está falhando.`,
  }),
  block(16, "exemplo-mais-trafego-nao-resolve", true, false, {
    type: "EXAMPLE",
    title: "Mais tráfego nem sempre é a resposta",
    body: `Uma empresa recebe 80 contatos por mês e fecha apenas 2 vendas.

A primeira reação pode ser:

“Precisamos de mais leads.”

Mas imagine que, ao analisar o processo, descobrimos que:

- metade dos contatos recebe resposta depois de várias horas;
- ninguém faz acompanhamento;
- os orçamentos são enviados sem explicação;
- não existe registro dos motivos de perda.

Gerar mais 80 contatos pode simplesmente dobrar o desperdício.

Antes de comprar mais tráfego, talvez seja melhor corrigir o processo de atendimento.`,
  }),
  block(17, "checkpoint-quando-anunciar", true, true, {
    type: "CHECKPOINT",
    question: "Qual situação abaixo representa o melhor motivo para adiar temporariamente uma campanha?",
    options: [
      { id: "orcamento-pequeno", label: "A. O orçamento inicial é pequeno." },
      { id: "oferta-e-atendimento", label: "B. A empresa ainda não definiu o que vai oferecer e não consegue atender os contatos atuais." },
      { id: "concorrentes-anunciam", label: "C. Existem concorrentes anunciando." },
      { id: "nunca-anunciou", label: "D. A empresa nunca anunciou antes." },
    ],
    correctOptionId: "oferta-e-atendimento",
    explanation:
      "Orçamento pequeno e falta de experiência não impedem automaticamente uma campanha. Mas anunciar sem oferta definida e sem capacidade de atendimento pode apenas aumentar um problema que já existe.",
  }),
  heading(18, "trafego-pago-nao-e-canal-unico", "Tráfego pago não significa apenas Google ou Instagram"),
  block(19, "canais-tem-comportamentos-diferentes", true, false, {
    type: "TEXT",
    body: `Existem diferentes plataformas de publicidade, e cada uma permite alcançar pessoas em contextos diferentes.

Duas situações ajudam a entender isso.

Pessoa procurando uma solução

Alguém pesquisa:

“clínica de ultrassom perto de mim”

Existe uma intenção clara naquele momento.

Plataformas de busca, como o Google, podem ser especialmente interessantes nesse contexto.

Pessoa que ainda não estava procurando

Agora imagine alguém navegando pelo Instagram e encontrando uma oferta que desperta seu interesse.

Essa pessoa não necessariamente estava pesquisando pelo produto naquele instante.

Plataformas como Instagram e Facebook podem trabalhar muito bem com descoberta e geração de demanda.

Nenhum dos dois modelos é automaticamente melhor.

A pergunta correta é:

“Qual deles combina melhor com meu objetivo, minha oferta e o comportamento do meu cliente?”

Essa será exatamente a questão da próxima aula.`,
  }),
  block(20, "google-meta-nao-sao-inimigos", true, false, {
    type: "CALLOUT",
    tone: "info",
    title: "Não existe obrigação de escolher um “time”",
    body: `Google Ads e Meta Ads não são rivais que exigem fidelidade.

Um negócio pode usar um, o outro ou ambos.

A escolha deve nascer da estratégia, não da preferência pessoal pela plataforma.`,
  }),
  heading(21, "atividade-meu-mapa", "Monte seu primeiro mapa de tráfego"),
  block(22, "atividade-primeiro-mapa", true, true, {
    type: "ACTIVITY",
    inputType: "long_text",
    prompt: `Meu primeiro mapa de tráfego

Agora aplique o conceito ao seu próprio negócio.

Não precisa ter todas as respostas perfeitas. O objetivo é transformar “quero anunciar” em algo mais concreto.

Responda:

1. O que você pretende divulgar primeiro?

2. Qual resultado você gostaria que essa divulgação gerasse?

3. Para onde a pessoa iria depois de clicar no anúncio?

4. Qual ação mostraria que a campanha gerou uma oportunidade real?

5. Existe hoje algum motivo importante para você não anunciar ainda?

Orientação:

Não tente escolher Google Ads ou Meta Ads ainda. Essa decisão será trabalhada na próxima aula.`,
  }),
  block(23, "resultado-primeiro-mapa", true, true, {
    type: "RESULT",
    title: "Seu primeiro mapa de tráfego",
    prompt: `Salve aqui o mapa principal desta aula.

Se você não encontrou um bloqueio, registre: Não identifiquei um bloqueio evidente neste momento.

Este é um mapa inicial criado a partir das suas próprias respostas. Ele não substitui o diagnóstico de prontidão que será realizado mais adiante no curso.`,
    fields: [
      { key: "oferta-inicial", label: "Minha oferta" },
      { key: "objetivo-inicial", label: "Quero gerar" },
      { key: "destino-inicial", label: "Depois do clique" },
      { key: "conversao-inicial", label: "Vou considerar uma oportunidade quando" },
      { key: "bloqueio-inicial", label: "Antes de anunciar preciso resolver" },
    ],
  }),
  heading(24, "o-que-levar-desta-aula", "O que você deve levar desta aula"),
  block(25, "resumo-conceitual", true, false, {
    type: "TEXT",
    body: `Se você guardar apenas cinco ideias desta aula, guarde estas:

1. Tráfego pago compra oportunidades de chegar às pessoas.

Ele não compra automaticamente vendas.

2. O anúncio é apenas uma parte do sistema.

Oferta, destino, atendimento e mensuração também importam.

3. Clique não é necessariamente resultado.

Você precisa definir qual ação realmente representa valor para o negócio.

4. Nem sempre a melhor decisão é anunciar imediatamente.

Em alguns casos, preparar a estrutura vem primeiro.

5. O canal deve ser escolhido pela estratégia.

Não por moda, preferência ou porque alguém disse que “Google é melhor” ou “Instagram vende mais”.`,
  }),
  block(26, "checkpoint-final-modelo", true, true, {
    type: "CHECKPOINT",
    question: "Qual representação descreve melhor o funcionamento de uma campanha?",
    options: [
      { id: "vendas-garantidas", label: "A. Dinheiro → anúncio → vendas garantidas." },
      { id: "seguidores-vendas", label: "B. Orçamento → seguidores → vendas." },
      { id: "caminho-medido", label: "C. Pessoa → anúncio → destino → ação → resultado medido." },
      { id: "clique-lucro", label: "D. Anúncio → clique → lucro." },
    ],
    correctOptionId: "caminho-medido",
    explanation:
      "Uma campanha faz parte de um caminho. O resultado depende da relação entre público, anúncio, destino, ação esperada e capacidade de acompanhar o que aconteceu.",
  }),
  block(27, "conclusao-aula-01", true, false, {
    type: "CONCLUSION",
    body: `Você já deu o primeiro passo

Agora você já consegue olhar para tráfego pago como um sistema, e não apenas como o botão “Impulsionar” ou uma campanha dentro de uma plataforma.

Você também criou seu primeiro mapa:

o que divulgar → o que deseja gerar → para onde levar a pessoa → qual ação importa.

A próxima pergunta é inevitável:

“Onde anunciar?”

Na próxima aula vamos comparar Google Ads e Meta Ads sem a simplificação de dizer que um é “melhor” que o outro.

Você vai entender em quais situações cada canal tende a fazer mais sentido e terminará com uma indicação inicial de canal para o seu próprio negócio.

Próxima recomendação:

Aula 2 — Google Ads ou Meta Ads: qual escolher?`,
  }),
];
