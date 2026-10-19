import type { LessonBlockData } from "@/lib/learning/blocks";

export const LESSON_11_SLUG = "leia-os-numeros";
export const LESSON_12_SLUG = "o-que-mudar";

export const lesson11Meta = {
  title: "Leia os números e encontre o gargalo",
  summary: "Veja o que o arquivo permite afirmar, onde a eficiência parece se perder e quando os dados ainda não sustentam uma conclusão.",
  publicPreview:
    "Um número isolado não diz onde a campanha perde eficiência. A leitura começa pelo que o arquivo realmente traz e pelo funil que esses dados sustentam.",
  estimatedMinutes: 40,
  accessType: "PAID" as const,
  priceCents: 3490,
  commerceStatus: "NOT_FOR_SALE" as const,
};

export type Lesson11Block = {
  blockKey: string;
  position: number;
  countsForProgress: boolean;
  required: boolean;
  data: LessonBlockData;
};

function block(position: number, blockKey: string, countsForProgress: boolean, required: boolean, data: LessonBlockData): Lesson11Block {
  return { position, blockKey, countsForProgress, required, data };
}

const heading = (position: number, blockKey: string, text: string) =>
  block(position, blockKey, false, false, { type: "HEADING", level: 2, text });

export const lesson11Blocks: Lesson11Block[] = [
  heading(1, "numeros-nao-falam-sozinhos", "Números não falam sozinhos"),
  block(2, "numero-isolado", true, false, {
    type: "TEXT",
    body: `A pergunta desta aula é o que os dados permitem afirmar. Não é qual resposta parece inteligente.

Um CPC, um CPA ou um ROAS, lidos sozinhos, não dizem se a campanha está no caminho. O mesmo custo por clique pode ser aceitável quando traz conversões e um sinal de atenção quando o clique não vira nada. Se o arquivo não tem a métrica, ela não aparece como zero. Aparece como não disponível neste arquivo.`,
  }),
  heading(3, "comece-pelo-funil", "Comece pelo funil"),
  block(4, "estagios-do-funil", true, false, {
    type: "TEXT",
    body: `O caminho conceitual tem cinco estágios. Entrega é impressão. Tráfego é clique, CTR e CPC. Conversão é conversão, taxa de conversão e CPA. Qualidade do lead só existe quando há lead e lead qualificado. Receita usa venda, receita, valor de conversão ou ROAS.

A ausência de um estágio não é um problema. Significa que este arquivo não tem esse dado. Não invente lead qualificado, receita nem um período que a planilha não trouxe.`,
  }),
  block(5, "ctr-cpc-cpa-em-contexto", true, false, {
    type: "TEXT",
    body: `CTR é cliques divididos pelas impressões. CPC é custo dividido pelos cliques. A taxa de conversão é conversões divididas pelos cliques. CPA é custo dividido pelas conversões. ROAS é valor de conversão ou receita dividido pelo custo.

Nenhuma dessas contas usa um número mágico de mercado. CTR “baixo” não significa anúncio ruim. CPC “alto” não significa lance errado. CPA “baixo” não garante contato útil. ROAS não é lucro: ele não conhece margem, imposto nem custo operacional. Se o denominador é zero, a métrica não existe. Não vira zero.`,
  }),
  block(6, "exemplo-tres-grupos", false, false, {
    type: "EXAMPLE",
    title: "Três grupos, o mesmo arquivo",
    body: `Imagine uma campanha de pesquisa com três grupos. O grupo A fica com metade do custo e a maior parte das conversões. O grupo B fica no meio. O grupo C absorve uma fatia material do custo e quase não contribui com conversões.

A comparação é interna. Não diz que o grupo C está “péssimo” nem manda pausar. Diz que a eficiência parece se perder ali, se o volume for material e os outros grupos tiverem convertido. A próxima aula é que decide o que fazer com esse sinal.`,
  }),
  heading(7, "base-e-derivada", "Métrica-base e métrica derivada"),
  block(8, "recalcule-sobre-o-total", true, false, {
    type: "TEXT",
    body: `Impressões, cliques, custo, conversões, valor de conversão, leads, leads qualificados, vendas e receita são bases. Elas se somam.

CTR, CPC, taxa de conversão, CPA, ROAS, CPL, taxa de qualificação e custo por lead qualificado são derivadas. Elas se calculam depois da soma. A média dos CTRs de cada linha não é o CTR do arquivo. Uma linha com pouco volume não pesa o mesmo que uma linha com quase todo o custo.`,
  }),
  block(9, "nao-mostrar-zero", false, false, {
    type: "CALLOUT",
    tone: "info",
    title: "Não disponível também é informação",
    body: "Se o arquivo não tem leads, receita ou lead qualificado, a leitura para nesse ponto. Mostrar zero fingiria um resultado que não foi medido.",
  }),
  block(10, "checkpoint-ctr", true, true, {
    type: "CHECKPOINT",
    question: "CTR baixo significa automaticamente anúncio ruim?",
    options: [
      { id: "nao", label: "Não. A taxa precisa do restante do funil e de uma comparação que o arquivo sustente" },
      { id: "sim", label: "Sim. Abaixo de um percentual fixo o anúncio está errado" },
      { id: "pause", label: "Sim, e o próximo passo é pausar o anúncio" },
    ],
    correctOptionId: "nao",
    explanation: "Não há um CTR universal. Sem contexto, a taxa não aponta a causa nem a ação.",
  }),
  block(11, "checkpoint-roas", true, true, {
    type: "CHECKPOINT",
    question: "ROAS 3 significa lucro de 3 vezes?",
    options: [
      { id: "nao", label: "Não necessariamente. O retorno sobre o anúncio não desconta margem e custos do negócio" },
      { id: "sim", label: "Sim. Cada real investido virou três de lucro" },
      { id: "meta", label: "Sim, porque 3 é o ROAS bom de qualquer setor" },
    ],
    correctOptionId: "nao",
    explanation: "ROAS compara valor registrado e custo do anúncio. Lucro é outra conta.",
  }),
  block(12, "checkpoint-sem-receita", true, true, {
    type: "CHECKPOINT",
    question: "Se não tenho receita nem valor de conversão, posso calcular ROAS?",
    options: [
      { id: "nao", label: "Não. Sem um desses valores, ROAS não está disponível" },
      { id: "zero", label: "Sim, e o resultado é zero" },
      { id: "cpa", label: "Sim, usando o CPA no lugar da receita" },
    ],
    correctOptionId: "nao",
    explanation: "ROAS precisa de valor de conversão ou receita, e de custo. O que falta não vira zero.",
  }),
  heading(13, "comparacao-interna", "Compare com este arquivo"),
  block(14, "sem-benchmark", true, false, {
    type: "TEXT",
    body: `Esta aula não usa meta fictícia nem benchmark de setor. CPC, CPA e ROAS “bons” dependem da oferta, da margem, do canal, do ticket e do momento. Se você não declarou uma meta, ela não é inventada aqui.

O que dá para fazer é olhar a estrutura do funil, a participação de cada segmento no custo e no resultado, e a ausência de resultado onde houve gasto material. Um grupo com 40% do custo e 10% das conversões é um sinal interno. Não é uma nota de mercado.`,
  }),
  block(15, "exemplo-meta", false, false, {
    type: "EXAMPLE",
    title: "Lead barato e lead qualificado",
    body: `Dois conjuntos podem ter custos por lead diferentes. Isso não diz qual contato presta, se o arquivo só tem lead.

Quando os dois números existem, um conjunto pode gerar muitos leads e qualificar poucos, e o outro o inverso. A qualidade entra na leitura só nesse caso. CPA baixo não substitui lead qualificado.`,
  }),
  block(16, "materialidade", false, false, {
    type: "CALLOUT",
    tone: "warning",
    title: "Volume pequeno não sustenta um alerta forte",
    body: "Uma linha com gasto irrelevante não vira gargalo. A heurística pede uma parcela material do custo antes de um sinal forte. Isso é uma trava conservadora, não uma lei do mercado.",
  }),
  heading(17, "evidencia", "Evidência, não sentença"),
  block(18, "forca-da-evidencia", true, false, {
    type: "TEXT",
    body: `A força é forte, moderada ou limitada. Forte é um padrão estrutural com os dados necessários: por exemplo, gasto material sem conversão enquanto outros segmentos converteram. Moderada é uma diferença interna relevante, ainda com volume ou contexto limitado. Limitada é pouco dado ou uma métrica importante ausente.

Isso não é percentual de confiança. E não é ordem para pausar, aumentar orçamento ou esperar. A aula seguinte é que transforma o diagnóstico em ação, teste ou espera.`,
  }),
  block(19, "dados-insuficientes", true, false, {
    type: "TEXT",
    body: `“Os dados ainda não permitem identificar um gargalo com segurança” é um resultado válido. Acontece quando falta métrica, quando só existe um estágio, quando não há com quem comparar ou quando o volume não sustenta a leitura.

O diagnóstico pronto significa que há um ponto de atenção legível. Não significa que a campanha está errada.`,
  }),
  block(20, "checklist-leitura", true, true, {
    type: "CHECKLIST",
    items: [
      { id: "bases", label: "Sei quais métricas o arquivo tem e quais não tem." },
      { id: "derivadas", label: "Sei que a taxa sai do total, não da média das linhas." },
      { id: "funil", label: "Consigo dizer qual estágio os dados alcançam." },
      { id: "interno", label: "Não usei um benchmark universal." },
      { id: "limite", label: "Consigo dizer o que este arquivo não permite concluir." },
    ],
  }),
  block(21, "atividade-pergunta", true, true, {
    type: "ACTIVITY",
    prompt: "Escreva, em uma frase, qual pergunta este arquivo deveria responder. Não invente uma métrica que ele não tem.",
    inputType: "long_text",
  }),
  heading(22, "explorar-dimensao", "Analise só o que existe"),
  block(23, "dimensoes-e-periodo", true, false, {
    type: "TEXT",
    body: `Campanha, grupo, conjunto, anúncio, palavra-chave, termo de pesquisa, posicionamento, dispositivo, rede e data só entram se estiverem no arquivo. Não há botão para uma dimensão ausente.

Se houver data, o período é a primeira e a última data do arquivo. Se não houver, o período não está informado. Poucas datas não viram tendência. Termo de pesquisa pode mostrar gasto sem resultado. Isso não classifica intenção nem sugere negativa.`,
  }),
  block(24, "diagnostico-de-resultados", true, true, {
    type: "TOOL",
    toolKey: "CAMPAIGN_PERFORMANCE_DIAGNOSIS_V1",
    title: "Diagnóstico dos resultados da campanha",
    description:
      "Escolha um arquivo pronto do seu projeto. A leitura soma as bases, calcula as taxas no total e aponta só o que esse arquivo sustenta. Ela não pausa anúncio, não muda orçamento e não envia o arquivo para fora.",
  }),
  block(25, "checkpoint-afirmacao", true, true, {
    type: "CHECKPOINT",
    question: "O que esta aula afirma quando encontra um gargalo?",
    options: [
      { id: "sinal", label: "Que há um sinal sustentado pelos dados, ainda sem decidir a ação" },
      { id: "pause", label: "Que aquele segmento deve ser pausado" },
      { id: "orcamento", label: "Que o orçamento deve aumentar no segmento melhor" },
    ],
    correctOptionId: "sinal",
    explanation: "O diagnóstico separa o que os números sustentam da decisão operacional. A ação fica para a próxima aula.",
  }),
  heading(26, "resultado-que-fica", "O que fica registrado"),
  block(27, "aula-12-decide", true, false, {
    type: "TEXT",
    body: `O resultado guarda o projeto, o arquivo, as métricas disponíveis, os totais, o estágio de atenção, as evidências e as limitações. A próxima aula usa isso para priorizar uma ação, um teste ou uma espera.

Sem esse diagnóstico, a próxima aula não deve inventar o gargalo. Sem arquivo pronto, esta aula também não inventa. Um plano antigo de oferta, destino ou lead pode aparecer como contexto. Ele não preenche número ausente.`,
  }),
  block(28, "conclusao-leitura", false, false, {
    type: "CONCLUSION",
    body: "Você sabe separar o que o arquivo mede, recalcular a taxa sobre o total e reconhecer quando a evidência chega ou quando ainda não dá para apontar um gargalo. O que mudar continua na aula seguinte.",
  }),
  block(29, "proxima-ainda-nao", false, false, {
    type: "CALLOUT",
    tone: "info",
    title: "A próxima aula decide o que fazer",
    body: "Saiba o que mudar — e quando não mexer ainda não está à venda. Disponível em breve. Ela recebe este diagnóstico. Esta aula não antecipa a espera nem a mudança.",
  }),
  block(30, "sem-aula-anterior", true, false, {
    type: "TEXT",
    body: `As aulas anteriores não são obrigatórias. Com um projeto e um arquivo pronto, a leitura acontece.

Se no mesmo projeto já existir objetivo, conversão desejada, destino, canal ou definição de lead, isso ajuda a lembrar o que o negócio queria medir. Não cria impressão, clique, lead nem receita.`,
  }),
  block(31, "mesmo-cpc", false, false, {
    type: "EXAMPLE",
    title: "O mesmo CPC, duas leituras",
    body: `Dois grupos podem ter CPC parecido. Um converte. O outro gasta e não registra conversão.

O CPC, sozinho, não separa os dois. A conversão e a participação no custo separam. Por isso a taxa derivada vem depois da soma, e o segmento só pesa quando o volume é material.`,
  }),
  block(32, "nao-pausar", true, false, {
    type: "TEXT",
    body: `Um sinal de gasto sem resultado não é uma instrução para pausar. Um ROAS maior não é uma instrução para aumentar orçamento. Evidência insuficiente não é uma instrução para esperar.

A linguagem desta aula é de sinal e de limite. “Há um sinal de…”, “este segmento merece investigação”, “os dados sugerem…”. Não é sentença sobre a campanha inteira.`,
  }),
  block(33, "atividade-limite", true, true, {
    type: "ACTIVITY",
    prompt: "Anote uma conclusão que o seu arquivo ainda não permite. Pode ser receita, lead qualificado, período ou comparação que não existe.",
    inputType: "long_text",
  }),
  heading(34, "forca-nao-e-nota", "Força não é nota"),
  block(35, "sem-porcentagem-magica", true, false, {
    type: "TEXT",
    body: `Não há uma nota de zero a cem. Há um estágio de atenção, quando os dados sustentam, e a força dessa evidência.

Se dois estágios aparecem com força parecida, o diagnóstico fica misto em vez de escolher um vencedor artificial. Se nada disso aparece, o resultado é evidência insuficiente. Os dois fecham a ferramenta.`,
  }),
  block(36, "o-que-entra-no-resultado", true, false, {
    type: "TEXT",
    body: `O nome da campanha, do grupo, do anúncio, da palavra ou do termo fica só no seu diagnóstico. Não vai para anúncio de audiência, não entra em relatório público e não aparece no admin operacional.

O arquivo continua no armazenamento privado. A ferramenta lê o necessário no servidor e devolve o resumo. Ela não manda a planilha inteira para o navegador.`,
  }),
];
