"use client";

import { useState } from "react";
import Link from "next/link";
import { saveResponsiveAd } from "@/lib/learning/actions";
import { buttonClass } from "@/lib/button-styles";
import {
  AD_READINESS_LABEL,
  DESCRIPTION_CATEGORIES,
  DESCRIPTION_CATEGORY_LABEL,
  HEADLINE_CATEGORIES,
  HEADLINE_CATEGORY_LABEL,
  RSA_LIMITS,
  rsaUnits,
  type ResponsiveAdPlan,
} from "@/lib/learning/responsive-search-ad";
import type { ResponsiveAdPanel } from "@/lib/learning/responsive-ad-plan";
import type { LessonSnapshot } from "@/lib/learning/reader-types";

const fieldClass = "mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm";

type DraftHeadline = { text: string; category: (typeof HEADLINE_CATEGORIES)[number]; pin: number };
type DraftDescription = { text: string; category: "" | (typeof DESCRIPTION_CATEGORIES)[number]; pin: number };
type DraftGroup = {
  name: string;
  theme: string;
  primaryIntent: string;
  keywordsContext: string[];
  negativeContext: string[];
  finalUrl: string;
  path1: string;
  path2: string;
  cta: string;
  headlines: DraftHeadline[];
  descriptions: DraftDescription[];
  preLaunchIssue: string;
};

export function ResponsiveSearchAdTool({
  panel,
  description,
  onSaved,
}: {
  panel: ResponsiveAdPanel | null;
  description: string;
  onSaved: (snapshot: LessonSnapshot) => void;
}) {
  if (!panel || panel.mode === "preview") {
    return (
      <div id="anuncios" className="mt-4 scroll-mt-28 rounded-lg border border-border bg-surface px-5 py-5">
        <p className="whitespace-pre-wrap text-base leading-relaxed">{description}</p>
        <p className="mt-4 text-sm leading-relaxed text-muted">
          Na aula publicada, este bloco grava o plano de anúncios na conta do aluno. Esta pré-visualização não cria projeto, resultado nem progresso.
        </p>
      </div>
    );
  }
  return <LiveAds panel={panel} description={description} onSaved={onSaved} />;
}

function LiveAds({
  panel,
  description,
  onSaved,
}: {
  panel: Extract<ResponsiveAdPanel, { mode: "live" }>;
  description: string;
  onSaved: (snapshot: LessonSnapshot) => void;
}) {
  const [current, setCurrent] = useState(panel);
  const [selected, setSelected] = useState(initialProject(panel));
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const project = current.projects.find((item) => item.id === selected) ?? null;

  async function onSubmit(input: Parameters<typeof saveResponsiveAd>[2]) {
    setPending(true);
    setError(null);
    const result = await saveResponsiveAd(current.lessonSlug, current.blockKey, input);
    setPending(false);
    if (!result.ok || !result.snapshot) {
      setError(result.ok ? "Não foi possível salvar." : result.message);
      return;
    }
    if (result.panel && isLiveAds(result.panel)) setCurrent(result.panel);
    onSaved(result.snapshot);
  }

  return (
    <div id="anuncios" className="mt-4 scroll-mt-28 rounded-lg border border-border bg-surface px-5 py-5">
      <p className="whitespace-pre-wrap text-base leading-relaxed">{description}</p>
      {!current.authenticated ? <p className="mt-5 text-base leading-relaxed">Entre na sua conta para montar os anúncios deste negócio.</p> : null}
      {current.authenticated && current.projects.length === 0 ? (
        <div className="mt-5">
          <p className="text-base leading-relaxed">Para escrever o anúncio, primeiro escolha qual negócio esta campanha atende.</p>
          <Link className={`${buttonClass("primary")} mt-4`} href={current.createProjectHref}>
            Criar meu projeto
          </Link>
        </div>
      ) : null}
      {current.authenticated && current.projects.length > 0 ? (
        <div className="mt-5 space-y-5">
          {current.chooseProject ? (
            <label className="block text-sm font-medium" htmlFor="negocio-dos-anuncios">
              Qual negócio você quer preparar?
              <select id="negocio-dos-anuncios" className={fieldClass} value={selected} onChange={(event) => setSelected(event.target.value)}>
                <option value="">Escolha um projeto</option>
                {current.projects.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {project?.plan ? <SavedAds plan={project.plan} /> : null}
          {project ? (
            <AdForm key={project.id} project={project} lessonSevenHref={current.lessonSevenHref} pending={pending} onSubmit={onSubmit} />
          ) : current.chooseProject ? (
            <p className="text-sm text-muted">Escolha o projeto para ver só os dados dele.</p>
          ) : null}
          {error ? <p className="text-sm text-muted">{error}</p> : null}
        </div>
      ) : null}
    </div>
  );
}

function AdForm({
  project,
  lessonSevenHref,
  pending,
  onSubmit,
}: {
  project: Extract<ResponsiveAdPanel, { mode: "live" }>["projects"][number];
  lessonSevenHref: string;
  pending: boolean;
  onSubmit: (input: Parameters<typeof saveResponsiveAd>[2]) => Promise<void>;
}) {
  const prefill = project.prefill;
  const [campaignName, setCampaignName] = useState(prefill.campaignName);
  const [offer, setOffer] = useState(prefill.offer);
  const [conversion, setConversion] = useState(prefill.conversion);
  const [destination, setDestination] = useState(prefill.destination);
  const [groups, setGroups] = useState(prefill.groups.map(toDraft));
  const [offerAccurate, setOfferAccurate] = useState(prefill.offerAccurate);
  const [destinationMatches, setDestinationMatches] = useState(prefill.destinationMatchesPromise);
  const [claimsReviewed, setClaimsReviewed] = useState(prefill.claimsReviewed);
  const [ctaMatches, setCtaMatches] = useState(prefill.ctaMatchesConversion);

  return (
    <form
      className="space-y-6"
      onSubmit={(event) => {
        event.preventDefault();
        void onSubmit({
          projectId: project.id,
          campaignName,
          offer,
          conversion,
          destination,
          groups: groups.map(toInput),
          offerAccurate,
          destinationMatchesPromise: destinationMatches,
          claimsReviewed,
          ctaMatchesConversion: ctaMatches,
        });
      }}
    >
      {prefill.fromBlueprint || prefill.fromKeywordPlan ? (
        <p className="text-sm leading-relaxed text-muted">
          {prefill.fromBlueprint ? "Nome, oferta, conversão e destino vieram da campanha deste projeto. " : ""}
          {prefill.fromKeywordPlan ? "As buscas marcadas para usar vieram da lista de palavras deste projeto." : "A lista de palavras ainda não está neste projeto."}
        </p>
      ) : (
        <p className="text-sm leading-relaxed text-muted">
          Este projeto ainda não tem a campanha nem a lista de palavras. Dá para continuar com o mínimo. Se você ainda não sabe quais buscas quer disputar,{" "}
          <Link className="underline underline-offset-4" href={lessonSevenHref}>
            a aula anterior ajuda a escolhê-las
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
      <label className="block text-sm font-medium">
        Conversão
        <input className={fieldClass} value={conversion} onChange={(event) => setConversion(event.target.value)} />
      </label>
      <label className="block text-sm font-medium">
        Destino
        <input className={fieldClass} value={destination} onChange={(event) => setDestination(event.target.value)} />
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
          <label className="block text-sm">
            Intenção
            <input className={fieldClass} value={group.primaryIntent} onChange={(event) => updateGroup(groupIndex, { primaryIntent: event.target.value })} />
          </label>
          <p className="text-sm text-muted">Buscas para usar: {group.keywordsContext.join(", ") || "nenhuma ainda"}</p>
          <p className="text-sm text-muted">Negativas, só como contexto: {group.negativeContext.join(", ") || "nenhuma nesta lista"}</p>
          <label className="block text-sm">
            URL final
            <input className={fieldClass} value={group.finalUrl} onChange={(event) => updateGroup(groupIndex, { finalUrl: event.target.value })} />
          </label>
          <div className="grid gap-2 md:grid-cols-2">
            <label className="block text-sm">
              Caminho 1
              <input className={fieldClass} value={group.path1} onChange={(event) => updateGroup(groupIndex, { path1: event.target.value })} />
              <Counter value={group.path1} max={RSA_LIMITS.pathUnits} />
            </label>
            <label className="block text-sm">
              Caminho 2
              <input className={fieldClass} value={group.path2} onChange={(event) => updateGroup(groupIndex, { path2: event.target.value })} />
              <Counter value={group.path2} max={RSA_LIMITS.pathUnits} />
            </label>
          </div>
          <label className="block text-sm">
            Chamado que corresponde à conversão
            <input className={fieldClass} value={group.cta} onChange={(event) => updateGroup(groupIndex, { cta: event.target.value })} />
          </label>
          <div className="space-y-2">
            <p className="text-sm font-medium">Títulos</p>
            {group.headlines.map((headline, index) => (
              <div key={index} className="grid gap-2 md:grid-cols-[1fr_auto_auto]">
                <div>
                  <input className={fieldClass} aria-label="Título" value={headline.text} onChange={(event) => updateHeadline(groupIndex, index, { text: event.target.value })} />
                  <Counter value={headline.text} max={RSA_LIMITS.headlineUnits} />
                </div>
                <select className={fieldClass} aria-label="Categoria do título" value={headline.category} onChange={(event) => updateHeadline(groupIndex, index, { category: event.target.value as DraftHeadline["category"] })}>
                  {HEADLINE_CATEGORIES.map((category) => (
                    <option key={category} value={category}>{HEADLINE_CATEGORY_LABEL[category]}</option>
                  ))}
                </select>
                <select className={fieldClass} aria-label="Fixar título" value={headline.pin} onChange={(event) => updateHeadline(groupIndex, index, { pin: Number(event.target.value) })}>
                  <option value={0}>Não fixar</option>
                  <option value={1}>Posição 1</option>
                  <option value={2}>Posição 2</option>
                  <option value={3}>Posição 3</option>
                </select>
              </div>
            ))}
            <button className="text-sm underline underline-offset-4" type="button" onClick={() => updateGroup(groupIndex, { headlines: [...group.headlines, blankHeadline()] })}>
              Adicionar título
            </button>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium">Descrições</p>
            {group.descriptions.map((item, index) => (
              <div key={index} className="grid gap-2 md:grid-cols-[1fr_auto_auto]">
                <div>
                  <textarea className={fieldClass} aria-label="Descrição" value={item.text} onChange={(event) => updateDescription(groupIndex, index, { text: event.target.value })} />
                  <Counter value={item.text} max={RSA_LIMITS.descriptionUnits} />
                </div>
                <select className={fieldClass} aria-label="Categoria da descrição" value={item.category} onChange={(event) => updateDescription(groupIndex, index, { category: event.target.value as DraftDescription["category"] })}>
                  <option value="">Sem categoria</option>
                  {DESCRIPTION_CATEGORIES.map((category) => (
                    <option key={category} value={category}>{DESCRIPTION_CATEGORY_LABEL[category]}</option>
                  ))}
                </select>
                <select className={fieldClass} aria-label="Fixar descrição" value={item.pin} onChange={(event) => updateDescription(groupIndex, index, { pin: Number(event.target.value) })}>
                  <option value={0}>Não fixar</option>
                  <option value={1}>Posição 1</option>
                  <option value={2}>Posição 2</option>
                </select>
              </div>
            ))}
            <button className="text-sm underline underline-offset-4" type="button" onClick={() => updateGroup(groupIndex, { descriptions: [...group.descriptions, blankDescription()] })}>
              Adicionar descrição
            </button>
          </div>
          <p className="text-sm text-muted">Fixar reduz as combinações possíveis.</p>
          <label className="block text-sm">
            Pendência, se houver
            <textarea className={fieldClass} value={group.preLaunchIssue} onChange={(event) => updateGroup(groupIndex, { preLaunchIssue: event.target.value })} />
          </label>
        </fieldset>
      ))}
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" checked={offerAccurate} onChange={(event) => setOfferAccurate(event.target.checked)} />
        O anúncio representa corretamente a oferta.
      </label>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" checked={destinationMatches} onChange={(event) => setDestinationMatches(event.target.checked)} />
        O destino cumpre o que o anúncio promete.
      </label>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" checked={claimsReviewed} onChange={(event) => setClaimsReviewed(event.target.checked)} />
        Revisei valores, condições e afirmações.
      </label>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" checked={ctaMatches} onChange={(event) => setCtaMatches(event.target.checked)} />
        O CTA corresponde à conversão.
      </label>
      <button className={buttonClass("primary")} type="submit" disabled={pending}>
        {pending ? "Salvando" : "Salvar plano de anúncios"}
      </button>
    </form>
  );

  function updateGroup(index: number, patch: Partial<DraftGroup>) {
    setGroups(groups.map((group, current) => (current === index ? { ...group, ...patch } : group)));
  }

  function updateHeadline(groupIndex: number, index: number, patch: Partial<DraftHeadline>) {
    updateGroup(groupIndex, {
      headlines: groups[groupIndex]!.headlines.map((headline, current) => (current === index ? { ...headline, ...patch } : headline)),
    });
  }

  function updateDescription(groupIndex: number, index: number, patch: Partial<DraftDescription>) {
    updateGroup(groupIndex, {
      descriptions: groups[groupIndex]!.descriptions.map((item, current) => (current === index ? { ...item, ...patch } : item)),
    });
  }
}

function SavedAds({ plan }: { plan: ResponsiveAdPlan }) {
  return (
    <div className="space-y-3 text-sm leading-relaxed">
      <p><strong>Campanha: </strong>{plan.campaignName}</p>
      {plan.groups.map((group) => (
        <div key={group.name}>
          <p><strong>Grupo: </strong>{group.name}</p>
          <p><strong>URL: </strong>{group.finalUrl || "ainda não informada"}</p>
          <p>Títulos:</p>
          <ol>
            {group.headlines.map((headline, index) => (
              <li key={`${headline.text}-${index}`}>{index + 1}. {headline.text}</li>
            ))}
          </ol>
          <p>Descrições:</p>
          <ol>
            {group.descriptions.map((item, index) => (
              <li key={`${item.text}-${index}`}>{index + 1}. {item.text}</li>
            ))}
          </ol>
          <p>Fixações: {group.pinning.length === 0 ? "nenhuma" : group.pinning.map((pin) => `${pin.assetType === "HEADLINE" ? "Título" : "Descrição"} ${pin.assetIndex + 1} → posição ${pin.position}`).join("; ")}</p>
        </div>
      ))}
      <p><strong>Status: </strong>{AD_READINESS_LABEL[plan.readinessStatus]}</p>
    </div>
  );
}

function Counter({ value, max }: { value: string; max: number }) {
  const units = rsaUnits(value);
  return <p className="mt-1 text-xs text-muted">{units}/{max}{units > max ? " acima do limite" : ""}</p>;
}

function toDraft(group: Extract<ResponsiveAdPanel, { mode: "live" }>["projects"][number]["prefill"]["groups"][number]): DraftGroup {
  const headlines = group.headlines.length > 0 ? group.headlines : [blankHeadline(), blankHeadline(), blankHeadline()];
  const descriptions = group.descriptions.length > 0 ? group.descriptions : [blankDescription(), blankDescription()];
  return {
    name: group.name,
    theme: group.theme,
    primaryIntent: group.primaryIntent,
    keywordsContext: group.keywordsContext,
    negativeContext: group.negativeContext,
    finalUrl: group.finalUrl,
    path1: group.path1,
    path2: group.path2,
    cta: group.cta,
    preLaunchIssue: group.preLaunchIssue,
    headlines: headlines.map((headline, index) => ({
      text: headline.text,
      category: isHeadlineCategory(headline.category) ? headline.category : "OFFER",
      pin: group.pinning.find((pin) => pin.assetType === "HEADLINE" && pin.assetIndex === index)?.position ?? 0,
    })),
    descriptions: descriptions.map((item, index) => ({
      text: item.text,
      category: isDescriptionCategory(item.category) ? item.category : "",
      pin: group.pinning.find((pin) => pin.assetType === "DESCRIPTION" && pin.assetIndex === index)?.position ?? 0,
    })),
  };
}

function toInput(group: DraftGroup): Parameters<typeof saveResponsiveAd>[2]["groups"][number] {
  const headlines = group.headlines.filter((headline) => headline.text.trim());
  const descriptions = group.descriptions.filter((item) => item.text.trim());
  return {
    name: group.name,
    theme: group.theme,
    primaryIntent: group.primaryIntent,
    keywordsContext: group.keywordsContext,
    negativeContext: group.negativeContext,
    finalUrl: group.finalUrl,
    path1: group.path1,
    path2: group.path2,
    cta: group.cta,
    headlines: headlines.map((headline) => ({ text: headline.text, category: headline.category })),
    descriptions: descriptions.map((item) => ({ text: item.text, category: item.category || undefined })),
    pinning: [
      ...headlines.flatMap((headline, index) => (headline.pin > 0 ? [{ assetType: "HEADLINE", assetIndex: index, position: headline.pin }] : [])),
      ...descriptions.flatMap((item, index) => (item.pin > 0 ? [{ assetType: "DESCRIPTION", assetIndex: index, position: item.pin }] : [])),
    ],
    preLaunchIssue: group.preLaunchIssue,
  };
}

function blankHeadline(): DraftHeadline {
  return { text: "", category: "OFFER", pin: 0 };
}

function blankDescription(): DraftDescription {
  return { text: "", category: "", pin: 0 };
}

function isHeadlineCategory(value: string | undefined): value is DraftHeadline["category"] {
  return HEADLINE_CATEGORIES.some((category) => category === value);
}

function isDescriptionCategory(value: string | undefined): value is DraftDescription["category"] {
  return DESCRIPTION_CATEGORIES.some((category) => category === value);
}

function isLiveAds(panel: { kind?: string; mode?: string } | null): panel is Extract<ResponsiveAdPanel, { mode: "live" }> {
  return Boolean(panel && panel.kind === "ads" && panel.mode === "live");
}

function initialProject(panel: Extract<ResponsiveAdPanel, { mode: "live" }>): string {
  if (panel.linkedProjectId && panel.projects.some((project) => project.id === panel.linkedProjectId)) return panel.linkedProjectId;
  if (panel.projects.length === 1) return panel.projects[0]?.id ?? "";
  return "";
}
