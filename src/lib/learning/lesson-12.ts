import type { LessonBlockData } from "@/lib/learning/blocks";

export const LESSON_12_SLUG = "o-que-mudar";

export const lesson12Meta = {
  title: "Saiba o que mudar — e quando não mexer",
  summary: "Transforme o diagnóstico em uma próxima ação defensável: executar, analisar, aprender ou esperar com critério.",
  publicPreview:
    "Nem todo dado pede uma mudança. Depois do diagnóstico, a decisão pode ser agir, investigar, estudar a base ou não mexer agora.",
  estimatedMinutes: 40,
  accessType: "PAID" as const,
  priceCents: 3990,
  commerceStatus: "NOT_FOR_SALE" as const,
};

export type Lesson12Block = {
  blockKey: string;
  position: number;
  countsForProgress: boolean;
  required: boolean;
  data: LessonBlockData;
};

function block(position: number, blockKey: string, countsForProgress: boolean, required: boolean, data: LessonBlockData): Lesson12Block {
  return { position, blockKey, countsForProgress, required, data };
}

const heading = (position: number, blockKey: string, text: string) =>
  block(position, blockKey, false, false, { type: "HEADING", level: 2, text });

export const lesson12Blocks: Lesson12Block[] = [
  heading(1, "mexer-cedo-demais", "O erro de mexer cedo demais"),
  block(2, "dado-nao-e-ordem", true, false, {
    type: "TEXT",
    body: `Dois dias de dados sem padrão forte não pedem cinco mudanças. Um número isolado também não.

A pergunta desta aula é qual é a próxima ação mais defensável com base nos dados — e o que observar antes de mexer de novo. Uma boa decisão pode ser mudar, testar, analisar mais ou não mexer agora.`,
  }),
  heading(3, "diagnostico-nao-e-decisao", "Diagnóstico não é decisão"),
  block(4, "aula-11-mostra-aula-12-decide", true, false, {
    type: "TEXT",
    body: `A aula anterior responde o que os dados mostram. Esta responde o que fazer diante disso.

O diagnóstico traz gargalo, evidências, força e limitações. Esta aula não recalcula o arquivo para inventar um problema novo. Ela consome o resultado e transforma evidência em prioridade, ação, teste ou espera.`,
  }),
  block(5, "uma-mudanca-por-vez", true, false, {
    type: "TEXT",
    body: `Se você muda cinco coisas ao mesmo tempo, fica difícil saber o que causou o resultado.

A regra desta aula é uma ação principal por ciclo. Pode existir um “depois”. Não existe um checklist de doze alterações. Planejar, executar, medir, diagnosticar, agir e medir de novo é o ciclo. Não é o fim do aprendizado.`,
  }),
  block(6, "acao-teste-espera", false, false, {
    type: "EXAMPLE",
    title: "Ação, teste e espera",
    body: `Um grupo concentrou uma fatia material do custo e não gerou conversões, enquanto outros grupos converteram. Isso pode virar uma ação: avaliar aquele grupo, revisar termos, anúncio e destino.

Dois dias sem padrão forte pedem espera com critério: o que observar, o que não mexer e quando revisar. WAIT não significa que não há trabalho. Significa que o melhor próximo passo é coletar mais evidência antes de alterar.`,
  }),
  heading(7, "quatro-tipos", "Quatro tipos de próximo passo"),
  block(8, "execute-analyze-wait-learn", true, false, {
    type: "TEXT",
    body: `EXECUTE descreve uma ação operacional concreta para você avaliar e executar. Não pausa anúncio sozinho e não aumenta orçamento sozinho.

ANALYZE aprofunda: destino, tracking, termos, anúncios, qualidade ou receita. WAIT observa com plano. LEARN aponta uma base do próprio curso quando o bloqueio ainda é conhecimento ou configuração.`,
  }),
  block(9, "wait-e-decisao", false, false, {
    type: "CALLOUT",
    tone: "info",
    title: "WAIT é uma decisão",
    body: "Esperar sem critério é omissão. Esperar com o que observar, o que não mexer e quando revisar é uma recomendação legítima.",
  }),
  block(10, "checkpoint-dois-dias", true, true, {
    type: "CHECKPOINT",
    question: "Se uma campanha teve dois dias de dados e nenhum padrão forte, devo mudar tudo?",
    options: [
      { id: "nao", label: "Não. Sem padrão forte, a mudança ampla reinicia o ciclo sem base" },
      { id: "sim", label: "Sim. Qualquer dado já pede otimização completa" },
      { id: "pause", label: "Sim, e o primeiro passo é pausar a campanha" },
    ],
    correctOptionId: "nao",
    explanation: "Poucos dados sem padrão forte pedem observação, não uma reforma geral.",
  }),
  heading(11, "regra-de-ouro", "Não pule o bloqueio anterior"),
  block(12, "bloqueio-fundamental", true, false, {
    type: "TEXT",
    body: `Se a mensuração está quebrada, não otimize ROAS. Se não há conversão confiável, não declare que uma palavra é ruim só pelo CPA. Se não há lead qualificado, não otimize qualidade inexistente.

A prioridade segue a força da evidência, a materialidade, a posição no funil e o risco de agir sem dados. Não existe urgência artificial nem nota de zero a cem.`,
  }),
  block(13, "checkpoint-pausar", true, true, {
    type: "CHECKPOINT",
    question: "Se um grupo gasta mais e converte menos relativamente, devo pausá-lo automaticamente?",
    options: [
      { id: "nao", label: "Não. Avalie o segmento; a pausa continua sendo sua decisão" },
      { id: "sim", label: "Sim. Qualquer gasto relativo maior exige pausa imediata" },
      { id: "orcamento", label: "Sim, e o orçamento deve subir 20% no melhor grupo" },
    ],
    correctOptionId: "nao",
    explanation: "A ferramenta pode pedir avaliação. Ela não pausa sozinha e não inventa percentual de orçamento.",
  }),
  heading(14, "catalogo-enxuto", "O que cada gargalo pede"),
  block(15, "por-estagio", true, false, {
    type: "TEXT",
    body: `Entrega sem impressão pede conferir elegibilidade, aprovação, limites e localização. Tráfego fraco pede revisar mensagem, busca, criativo ou público. Conversão fraca pede destino, CTA, formulário, evento e intenção.

Qualidade de lead só entra com lead e lead qualificado. Receita só entra com receita, valor de conversão ou vendas. Misto escolhe uma prioridade. Evidência insuficiente tende a WAIT ou a completar o arquivo.`,
  }),
  block(16, "exemplo-gasto-sem-conversao", false, false, {
    type: "EXAMPLE",
    title: "Gasto material sem conversão",
    body: `Grupo A ficou com uma fatia alta do custo e zero conversões. Outros grupos converteram. A evidência é forte.

O plano não diz “pause o Grupo A”. Diz para avaliar aquele grupo antes de manter a mesma proporção de investimento, revisar termos, anúncios e destino, e só então decidir. Depois, observar de novo.`,
  }),
  block(17, "exemplo-cliques-sem-conversao", false, false, {
    type: "EXAMPLE",
    title: "Cliques sem conversão",
    body: `Há clique e não há conversão. O primeiro passo costuma ser analisar se a página e a conversão definida correspondem à promessa do anúncio.

Não assuma que o anúncio está errado. Destino, formulário e tracking entram antes de uma troca criativa ampla.`,
  }),
  block(18, "checkpoint-wait", true, true, {
    type: "CHECKPOINT",
    question: "WAIT significa que não existe trabalho a fazer?",
    options: [
      { id: "nao", label: "Não. Significa observar com critério definido" },
      { id: "sim", label: "Sim. WAIT encerra a aula sem próximo passo" },
      { id: "pause", label: "Sim, e a campanha deve ser pausada enquanto isso" },
    ],
    correctOptionId: "nao",
    explanation: "WAIT registra o que observar, o que não mexer e quando revisar.",
  }),
  heading(19, "hipotese-e-observacao", "Hipótese e janela de observação"),
  block(20, "hipotese-sem-promessa", true, false, {
    type: "TEXT",
    body: `Quando a ação for executar uma revisão, a hipótese descreve o que você espera aprender ou melhorar. Ela não promete resultado.

Se no brief você já escolheu 7, 14, 21 ou 30 dias de observação, isso pode aparecer como contexto. Não é regra científica. Sem data confiável, você escolhe quando revisar.`,
  }),
  block(21, "checklist-decisao", false, false, {
    type: "CHECKLIST",
    items: [
      { id: "uma", label: "Escolhi uma ação principal, não uma lista longa." },
      { id: "evidencia", label: "Sei qual evidência sustenta essa escolha." },
      { id: "observar", label: "Sei o que observar antes da próxima mudança." },
      { id: "nao-mexer", label: "Sei o que não mexer neste ciclo." },
      { id: "wait", label: "Aceito WAIT quando a evidência ainda é fraca." },
    ],
  }),
  block(22, "atividade-proxima", true, true, {
    type: "ACTIVITY",
    prompt: "Escreva a próxima ação mais defensável para o seu caso agora. Se for esperar, diga o que vai observar e o que não vai mexer.",
    inputType: "long_text",
  }),
  heading(23, "ferramenta", "Do diagnóstico ao plano"),
  block(24, "plano-proxima-acao", true, true, {
    type: "TOOL",
    toolKey: "CAMPAIGN_NEXT_ACTION_PLAN_V1",
    title: "Plano de próxima ação",
    description:
      "Escolha o projeto e o arquivo. A ferramenta usa o diagnóstico já calculado, sugere uma ação principal e deixa você aceitar, ajustar ou registrar espera. Task e lembrete só nascem se você confirmar.",
  }),
  block(25, "checkpoint-roas-orcamento", true, true, {
    type: "CHECKPOINT",
    question: "ROAS alto significa que devo aumentar orçamento?",
    options: [
      { id: "nao", label: "Não automaticamente. ROAS não conhece margem, meta nem capacidade" },
      { id: "sim", label: "Sim. ROAS alto autoriza aumento percentual imediato" },
      { id: "vinte", label: "Sim, aumente 20% como regra geral" },
    ],
    correctOptionId: "nao",
    explanation: "Orçamento sem meta e sem contexto não vira percentual inventado nesta aula.",
  }),
  heading(26, "plano-vivo", "O plano continua no projeto"),
  block(27, "task-reminder", true, false, {
    type: "TEXT",
    body: `EXECUTE e ANALYZE podem virar tarefa no plano do projeto, se você pedir. WAIT pode virar lembrete de revisão, se você confirmar a data.

Reabrir a ferramenta não cria tarefa, lembrete nem recomendação duplicada sem a sua ação. O resultado guarda a sugestão do sistema e a sua decisão, mesmo quando elas forem diferentes.`,
  }),
  block(28, "atividade-nao-mexer", true, true, {
    type: "ACTIVITY",
    prompt: "Liste duas coisas que você não vai mudar neste ciclo, mesmo que alguém peça “otimização rápida”.",
    inputType: "long_text",
  }),
  block(29, "conclusao-ciclo", false, false, {
    type: "CONCLUSION",
    body: "Você sabe transformar diagnóstico em uma próxima ação defensável e reconhecer quando a melhor decisão é esperar. O curso fecha um ciclo: planejar, executar, medir, diagnosticar, agir e medir de novo.",
  }),
  block(30, "cta-plano", false, false, {
    type: "CALLOUT",
    tone: "tip",
    title: "Continue no seu projeto",
    body: "O próximo passo prático é ver o plano vivo do projeto. Você também pode revisar o aprendizado. Se preferir delegar a gestão, o serviço de tráfego pago continua disponível sem empurrão.",
  }),
  block(31, "sem-aula-11-visual", true, false, {
    type: "TEXT",
    body: `Se o arquivo READY existe no projeto, esta aula pode obter o diagnóstico pelas funções internas mesmo sem você ter concluído visualmente a aula anterior.

Sem arquivo READY, não há plano inventado. O caminho é enviar os dados. Diagnóstico, importação e plano precisam ser do mesmo projeto.`,
  }),
  block(32, "exemplo-sem-receita", false, false, {
    type: "EXAMPLE",
    title: "Sem receita no arquivo",
    body: `Se a pergunta for retorno financeiro e o arquivo não tem receita nem valor de conversão suficiente, o passo é analisar: incluir esse dado na próxima exportação.

Não invente ROAS. Não pause por um retorno que o arquivo não mostrou.`,
  }),
  block(33, "exemplo-leads-sem-qualidade", false, false, {
    type: "EXAMPLE",
    title: "Leads sem qualificação",
    body: `Há leads e não há leads qualificados. O plano pede para começar a registrar quais contatos atendem à sua definição.

Isso não afirma que os leads estão ruins. Afirma que qualidade ainda não pode ser julgada com o arquivo atual.`,
  }),
  heading(34, "privacidade-da-decisao", "A decisão continua privada"),
  block(35, "sem-analytics-privado", true, false, {
    type: "TEXT",
    body: `Gargalo, evidência, nome de campanha, grupo, palavra, termo, métricas, valores e o plano completo não vão para analytics. O log guarda só operação, status e identificadores opacos.

O preview administrativo mostra o conteúdo da aula. Não mostra o arquivo privado nem o plano estratégico do aluno.`,
  }),
  block(36, "links-finais", true, false, {
    type: "TEXT",
    body: `Depois de salvar o plano, abra o projeto para ver a próxima ação no plano vivo. Se quiser rever o caminho, volte ao aprendizado. Se preferir que a gestão fique comigo, o caminho é o serviço de tráfego pago.

Esta aula encerra o curso como ciclo, não como ponto final.`,
  }),
];
