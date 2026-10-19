"use client";

import { useState } from "react";
import Link from "next/link";
import { saveKeywordIntent } from "@/lib/learning/actions";
import { buttonClass } from "@/lib/button-styles";
import {
  DECISION_LABEL,
  INTENT_LABEL,
  KEYWORD_DECISIONS,
  KEYWORD_INTENTS,
  MATCH_TYPES,
  MATCH_TYPE_LABEL,
  READINESS_LABEL,
  type KeywordPlan,
} from "@/lib/learning/keyword-intent";
import type { KeywordIntentPanel } from "@/lib/learning/keyword-plan";
import type { LessonSnapshot } from "@/lib/learning/reader-types";

const fieldClass = "mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm";

export function KeywordIntentTool({
  panel,
  description,
  onSaved,
}: {
  panel: KeywordIntentPanel | null;
  description: string;
  onSaved: (snapshot: LessonSnapshot) => void;
}) {
  if (!panel || panel.mode === "preview") {
    return (
      <div id="palavras" className="mt-4 scroll-mt-28 rounded-lg border border-border bg-surface px-5 py-5">
        <p className="whitespace-pre-wrap text-base leading-relaxed">{description}</p>
        <p className="mt-4 text-sm leading-relaxed text-muted">
          Na aula publicada, este bloco grava o plano de palavras-chave na conta do aluno. Esta pré-visualização não cria projeto, resultado nem progresso.
        </p>
      </div>
    );
  }
  return <LiveKeywords panel={panel} description={description} onSaved={onSaved} />;
}

function LiveKeywords({
  panel,
  description,
  onSaved,
}: {
  panel: Extract<KeywordIntentPanel, { mode: "live" }>;
  description: string;
  onSaved: (snapshot: LessonSnapshot) => void;
}) {
  const [current, setCurrent] = useState(panel);
  const [selected, setSelected] = useState(initialProject(panel));
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const project = current.projects.find((item) => item.id === selected) ?? null;

  async function onSubmit(input: Parameters<typeof saveKeywordIntent>[2]) {
    setPending(true);
    setError(null);
    const result = await saveKeywordIntent(current.lessonSlug, current.blockKey, input);
    setPending(false);
    if (!result.ok || !result.snapshot) {
      setError(result.ok ? "Não foi possível salvar." : result.message);
      return;
    }
    if (result.panel && isLiveKeywords(result.panel)) setCurrent(result.panel);
    onSaved(result.snapshot);
  }

  return (
    <div id="palavras" className="mt-4 scroll-mt-28 rounded-lg border border-border bg-surface px-5 py-5">
      <p className="whitespace-pre-wrap text-base leading-relaxed">{description}</p>
      {!current.authenticated ? <p className="mt-5 text-base leading-relaxed">Entre na sua conta para montar a lista deste negócio.</p> : null}
      {current.authenticated && current.projects.length === 0 ? (
        <div className="mt-5">
          <p className="text-base leading-relaxed">Para organizar as buscas, primeiro escolha qual negócio esta campanha atende.</p>
          <Link className={`${buttonClass("primary")} mt-4`} href={current.createProjectHref}>
            Criar meu projeto
          </Link>
        </div>
      ) : null}
      {current.authenticated && current.projects.length > 0 ? (
        <div className="mt-5 space-y-5">
          {current.chooseProject ? (
            <label className="block text-sm font-medium" htmlFor="negocio-das-palavras">
              Qual negócio você quer preparar?
              <select id="negocio-das-palavras" className={fieldClass} value={selected} onChange={(event) => setSelected(event.target.value)}>
                <option value="">Escolha um projeto</option>
                {current.projects.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {project?.plan ? <SavedPlan plan={project.plan} adsLessonReady={current.adsLessonReady} adsLessonHref={current.adsLessonHref} /> : null}
          {project ? (
            <KeywordForm key={project.id} project={project} lessonSixHref={current.lessonSixHref} pending={pending} onSubmit={onSubmit} />
          ) : current.chooseProject ? (
            <p className="text-sm text-muted">Escolha o projeto para ver só os dados dele.</p>
          ) : null}
          {error ? <p className="text-sm text-muted">{error}</p> : null}
        </div>
      ) : null}
    </div>
  );
}

function KeywordForm({
  project,
  lessonSixHref,
  pending,
  onSubmit,
}: {
  project: Extract<KeywordIntentPanel, { mode: "live" }>["projects"][number];
  lessonSixHref: string;
  pending: boolean;
  onSubmit: (input: Parameters<typeof saveKeywordIntent>[2]) => Promise<void>;
}) {
  const [campaignName, setCampaignName] = useState(project.prefill.campaignName);
  const [offer, setOffer] = useState(project.prefill.offer);
  const [groups, setGroups] = useState(
    project.prefill.groups.map((group) => ({
      ...group,
      keywords: group.keywords.length > 0 ? group.keywords : [{ text: "", matchType: "PHRASE" as const, intent: "HIGH" as const, decision: "USE" as const }],
    })),
  );
  const [negatives, setNegatives] = useState(project.prefill.negativeKeywords);
  const [issue, setIssue] = useState(project.prefill.preLaunchIssue);
  const [reviewed, setReviewed] = useState(project.prefill.reviewed);

  return (
    <form
      className="space-y-6"
      onSubmit={(event) => {
        event.preventDefault();
        void onSubmit({
          projectId: project.id,
          campaignName,
          offer,
          groups: groups.map((group) => ({
            name: group.name,
            theme: group.theme,
            keywords: group.keywords.filter((keyword) => keyword.text.trim()),
          })),
          negativeKeywords: negatives.filter((item) => item.text.trim()),
          preLaunchIssue: issue,
          reviewed,
        });
      }}
    >
      {project.prefill.fromBlueprint ? (
        <p className="text-sm leading-relaxed text-muted">
          Este projeto já tem o Blueprint da campanha. Nome, oferta e grupos vieram de lá.
          {project.prefill.objective ? ` Objetivo: ${labelObjective(project.prefill.objective)}.` : ""}
          {project.prefill.conversion ? ` Conversão: ${project.prefill.conversion}.` : ""}
        </p>
      ) : (
        <p className="text-sm leading-relaxed text-muted">
          Este projeto ainda não tem o Blueprint. Dá para continuar com o mínimo. Se a estrutura da campanha ainda não existe,{" "}
          <Link className="underline underline-offset-4" href={lessonSixHref}>
            a aula anterior ajuda a montá-la
          </Link>
          .
        </p>
      )}
      <label className="block text-sm font-medium">
        Nome da campanha
        <input className={fieldClass} value={campaignName} onChange={(event) => setCampaignName(event.target.value)} />
      </label>
      <label className="block text-sm font-medium">
        Oferta
        <input className={fieldClass} value={offer} onChange={(event) => setOffer(event.target.value)} />
      </label>
      {groups.map((group, groupIndex) => (
        <fieldset key={`${project.id}-${groupIndex}`} className="space-y-3 rounded-lg border border-border p-4">
          <legend className="px-1 text-sm font-medium">Grupo {groupIndex + 1}</legend>
          <label className="block text-sm">
            Nome
            <input className={fieldClass} value={group.name} onChange={(event) => updateGroup(groupIndex, { name: event.target.value })} />
          </label>
          <label className="block text-sm">
            Tema
            <input className={fieldClass} value={group.theme} onChange={(event) => updateGroup(groupIndex, { theme: event.target.value })} />
          </label>
          {group.sourceIntent ? <p className="text-sm text-muted">Intenção definida na aula anterior: {group.sourceIntent}</p> : null}
          <ul className="space-y-2 text-sm leading-relaxed text-muted">
            <li>Essa busca indica que a pessoa procura aquilo que você oferece?</li>
            <li>Ela está perto da conversão que você definiu?</li>
            <li>Esse termo merece orçamento agora?</li>
          </ul>
          {group.keywords.map((keyword, keywordIndex) => (
            <div key={`${groupIndex}-${keywordIndex}`} className="grid gap-2 md:grid-cols-4">
              <input className={fieldClass} aria-label="Palavra-chave" value={keyword.text} onChange={(event) => updateKeyword(groupIndex, keywordIndex, { text: event.target.value })} />
              <select className={fieldClass} aria-label="Correspondência" value={keyword.matchType} onChange={(event) => updateKeyword(groupIndex, keywordIndex, { matchType: event.target.value as typeof keyword.matchType })}>
                {MATCH_TYPES.map((type) => (
                  <option key={type} value={type}>{MATCH_TYPE_LABEL[type]}</option>
                ))}
              </select>
              <select className={fieldClass} aria-label="Intenção" value={keyword.intent} onChange={(event) => updateKeyword(groupIndex, keywordIndex, { intent: event.target.value as typeof keyword.intent })}>
                {KEYWORD_INTENTS.map((intent) => (
                  <option key={intent} value={intent}>{INTENT_LABEL[intent]}</option>
                ))}
              </select>
              <select className={fieldClass} aria-label="Decisão" value={keyword.decision} onChange={(event) => updateKeyword(groupIndex, keywordIndex, { decision: event.target.value as typeof keyword.decision })}>
                {KEYWORD_DECISIONS.map((decision) => (
                  <option key={decision} value={decision}>{DECISION_LABEL[decision]}</option>
                ))}
              </select>
            </div>
          ))}
          <button
            className="text-sm underline underline-offset-4"
            type="button"
            onClick={() =>
              updateGroup(groupIndex, {
                keywords: [...group.keywords, { text: "", matchType: "PHRASE", intent: "HIGH", decision: "USE" }],
              })
            }
          >
            Adicionar palavra-chave
          </button>
          <p className="text-sm text-muted">Comece enxuto. Você poderá ampliar depois usando dados reais.</p>
        </fieldset>
      ))}
      <section className="space-y-3">
        <h3 className="text-sm font-medium">Negativas</h3>
        {negatives.map((item, index) => (
          <div key={index} className="grid gap-2 md:grid-cols-3">
            <input className={fieldClass} aria-label="Negativa" value={item.text} onChange={(event) => updateNegative(index, { text: event.target.value })} />
            <select className={fieldClass} aria-label="Escopo da negativa" value={item.scope} onChange={(event) => updateNegative(index, { scope: event.target.value as typeof item.scope })}>
              <option value="CAMPAIGN">Campanha</option>
              <option value="AD_GROUP">Grupo</option>
            </select>
            {item.scope === "AD_GROUP" ? (
              <select className={fieldClass} aria-label="Grupo da negativa" value={item.groupName ?? ""} onChange={(event) => updateNegative(index, { groupName: event.target.value })}>
                <option value="">Escolha o grupo</option>
                {groups.map((group) => (
                  <option key={group.name} value={group.name}>{group.name || "Grupo sem nome"}</option>
                ))}
              </select>
            ) : null}
          </div>
        ))}
        <button className="text-sm underline underline-offset-4" type="button" onClick={() => setNegatives([...negatives, { text: "", scope: "CAMPAIGN" }])}>
          Adicionar negativa
        </button>
      </section>
      <label className="block text-sm font-medium">
        Pendência, se houver
        <textarea className={fieldClass} value={issue} onChange={(event) => setIssue(event.target.value)} />
      </label>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" checked={reviewed} onChange={(event) => setReviewed(event.target.checked)} />
        Revisei esta lista e sei quais buscas quero pagar agora.
      </label>
      <button className={buttonClass("primary")} type="submit" disabled={pending}>
        {pending ? "Salvando" : "Salvar plano de palavras-chave"}
      </button>
    </form>
  );

  function updateGroup(index: number, patch: Partial<(typeof groups)[number]>) {
    setGroups(groups.map((group, groupIndex) => (groupIndex === index ? { ...group, ...patch } : group)));
  }

  function updateKeyword(groupIndex: number, keywordIndex: number, patch: Partial<(typeof groups)[number]["keywords"][number]>) {
    setGroups(
      groups.map((group, index) =>
        index === groupIndex
          ? { ...group, keywords: group.keywords.map((keyword, current) => (current === keywordIndex ? { ...keyword, ...patch } : keyword)) }
          : group,
      ),
    );
  }

  function updateNegative(index: number, patch: Partial<(typeof negatives)[number]>) {
    setNegatives(negatives.map((item, current) => (current === index ? { ...item, ...patch } : item)));
  }
}

function SavedPlan({ plan, adsLessonReady, adsLessonHref }: { plan: KeywordPlan; adsLessonReady: boolean; adsLessonHref: string }) {
  const chosen = plan.groups.flatMap((group) => group.keywords);
  const high = chosen.filter((keyword) => keyword.intent === "HIGH").length;
  const later = chosen.filter((keyword) => keyword.decision === "TEST_LATER").length;
  const excluded = chosen.filter((keyword) => keyword.decision === "EXCLUDE").length;
  return (
    <div className="space-y-3 text-sm leading-relaxed">
      <p><strong>Campanha: </strong>{plan.campaignName}</p>
      {plan.groups.map((group) => (
        <div key={group.name}>
          <p><strong>Grupo: </strong>{group.name}</p>
          <p>Keywords escolhidas:</p>
          <ul>
            {group.keywords.filter((keyword) => keyword.decision === "USE").map((keyword) => (
              <li key={`${group.name}-${keyword.text}-${keyword.matchType}`}>[{MATCH_TYPE_LABEL[keyword.matchType]}] {keyword.text}</li>
            ))}
          </ul>
        </div>
      ))}
      <p>Alta intenção: {high}</p>
      <p>Testar depois: {later}</p>
      <p>Excluir: {excluded}</p>
      <p>Negativas: {plan.negativeKeywords.map((item) => item.text).join(", ") || "nenhuma nesta lista"}</p>
      <p><strong>Status: </strong>{READINESS_LABEL[plan.readinessStatus]}</p>
      {plan.readinessStatus === "READY_FOR_ADS" ? (
        adsLessonReady ? (
          <Link className="underline underline-offset-4" href={adsLessonHref}>Criar anúncios alinhados à conversão</Link>
        ) : (
          <p>Criar anúncios alinhados à conversão. Disponível em breve.</p>
        )
      ) : null}
    </div>
  );
}

function isLiveKeywords(panel: { kind?: string; mode?: string } | null): panel is Extract<KeywordIntentPanel, { mode: "live" }> {
  return Boolean(panel && panel.kind === "keywords" && panel.mode === "live");
}

function initialProject(panel: Extract<KeywordIntentPanel, { mode: "live" }>): string {
  if (panel.linkedProjectId && panel.projects.some((project) => project.id === panel.linkedProjectId)) return panel.linkedProjectId;
  if (panel.projects.length === 1) return panel.projects[0]?.id ?? "";
  return "";
}

function labelObjective(value: string): string {
  return value.replaceAll("_", " ").toLocaleLowerCase("pt-BR");
}
