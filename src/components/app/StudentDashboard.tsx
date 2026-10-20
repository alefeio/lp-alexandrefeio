"use client";

import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  Check,
  Compass,
  FileSpreadsheet,
  Rocket,
  Target,
} from "lucide-react";
import { useId, useState } from "react";
import { Container } from "@/components/ui/Container";
import { buttonClass } from "@/lib/button-styles";
import type {
  JourneyStageView,
  MilestoneView,
  QuickAccessCard,
  StudentDashboardViewModel,
} from "@/lib/home/student-dashboard";

const ACCESS_ICON = {
  course: BookOpen,
  project: Target,
  data: FileSpreadsheet,
  plan: Rocket,
  learning: Compass,
} as const;

export function StudentDashboard({ view }: { view: StudentDashboardViewModel }) {
  const [showAllMilestones, setShowAllMilestones] = useState(false);
  const progressId = useId();
  const milestones = showAllMilestones ? view.milestones : view.visibleMilestones;

  return (
    <Container className="max-w-4xl py-10 sm:py-12">
      <header className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">{view.greeting}</h1>
          <p className="mt-2 text-sm text-muted">{view.subtext}</p>
        </div>
        <ProgressRing
          id={progressId}
          percentage={view.progress.percentage}
          label={view.progress.label}
          detail={`${view.progress.completedLessons} de ${view.progress.accessibleLessons} aulas`}
        />
      </header>

      <section
        aria-labelledby="next-step-heading"
        className={`mt-8 rounded-xl border p-5 sm:p-6 ${
          view.nextAction.tone === "wait"
            ? "border-border bg-surface"
            : view.nextAction.tone === "celebrate"
              ? "border-accent/40 bg-surface"
              : "border-cta/30 bg-surface shadow-sm"
        }`}
      >
        <p id="next-step-heading" className="text-xs font-medium uppercase tracking-[0.14em] text-cta">
          {view.nextAction.eyebrow}
        </p>
        <h2 className="mt-3 text-xl font-semibold tracking-tight text-foreground">{view.nextAction.title}</h2>
        {view.nextAction.detail ? <p className="mt-2 text-sm text-muted">{view.nextAction.detail}</p> : null}
        {view.nextAction.percent != null ? (
          <p className="mt-2 text-sm text-muted" aria-label={`Progresso da aula: ${view.nextAction.percent}%`}>
            {view.nextAction.percent}% concluída
          </p>
        ) : null}
        <p className="mt-5">
          <Link className={buttonClass("primary")} href={view.nextAction.href}>
            {view.nextAction.cta}
            <ArrowRight className="ml-2 inline size-4" aria-hidden />
          </Link>
        </p>
      </section>

      <section aria-labelledby="journey-heading" className="mt-10">
        <h2 id="journey-heading" className="text-sm font-medium text-foreground">
          Sua jornada
        </h2>
        <ol className="mt-4 flex gap-3 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:grid sm:grid-cols-5 sm:overflow-visible sm:pb-0">
          {view.journeyStages.map((stage) => (
            <li key={stage.id} className="min-w-[7.5rem] flex-1 sm:min-w-0">
              <JourneyStageItem stage={stage} />
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="access-heading" className="mt-10">
        <h2 id="access-heading" className="text-sm font-medium text-foreground">
          Acessos rápidos
        </h2>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {view.quickAccess.map((card) => (
            <li key={card.id}>
              <QuickAccessLink card={card} />
            </li>
          ))}
        </ul>
      </section>

      {!view.isNewStudent ? (
        <section aria-labelledby="milestones-heading" className="mt-10">
          <div className="flex items-center justify-between gap-3">
            <h2 id="milestones-heading" className="text-sm font-medium text-foreground">
              Marcos da jornada
            </h2>
            {view.milestones.length > view.visibleMilestones.length || showAllMilestones ? (
              <button
                type="button"
                className="text-sm font-medium text-cta underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cta"
                onClick={() => setShowAllMilestones((value) => !value)}
              >
                {showAllMilestones ? "Ver menos" : "Ver todos"}
              </button>
            ) : null}
          </div>
          <ul className="mt-4 flex flex-wrap gap-2">
            {milestones.map((item) => (
              <li key={item.id}>
                <MilestoneChip item={item} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </Container>
  );
}

function ProgressRing({
  id,
  percentage,
  label,
  detail,
}: {
  id: string;
  percentage: number;
  label: string;
  detail: string;
}) {
  const radius = 34;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;
  return (
    <div className="flex items-center gap-3" aria-labelledby={id}>
      <svg width="88" height="88" viewBox="0 0 88 88" className="shrink-0" role="img" aria-label={`${label}: ${percentage}% concluído`}>
        <circle cx="44" cy="44" r={radius} fill="none" stroke="currentColor" strokeWidth="8" className="text-border" />
        <circle
          cx="44"
          cy="44"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="origin-center -rotate-90 text-cta motion-safe:transition-[stroke-dashoffset] motion-safe:duration-500"
        />
        <text x="44" y="48" textAnchor="middle" className="fill-foreground text-[0.95rem] font-semibold">
          {percentage}%
        </text>
      </svg>
      <div>
        <p id={id} className="text-sm font-medium text-foreground">
          {label}
        </p>
        <p className="mt-1 text-sm text-muted">{detail}</p>
      </div>
    </div>
  );
}

function JourneyStageItem({ stage }: { stage: JourneyStageView }) {
  const mark =
    stage.status === "done" ? "✓" : stage.status === "current" ? "●" : stage.status === "locked" ? "–" : "○";
  const label =
    stage.status === "done"
      ? `${stage.label}, concluída`
      : stage.status === "current"
        ? `${stage.label}, etapa atual`
        : stage.status === "locked"
          ? `${stage.label}, indisponível no seu acesso`
          : `${stage.label}, próxima`;
  return (
    <div
      className={`rounded-lg border px-3 py-3 ${
        stage.status === "current"
          ? "border-cta/40 bg-surface"
          : stage.status === "done"
            ? "border-border bg-surface"
            : "border-border/80 bg-transparent"
      }`}
      aria-label={label}
    >
      <p className="text-sm font-medium text-foreground" aria-hidden>
        <span className="mr-1.5 text-cta">{mark}</span>
        {stage.label}
      </p>
      <p className="mt-1 text-xs text-muted">
        {stage.status === "done"
          ? "Concluída"
          : stage.status === "current"
            ? "Atual"
            : stage.status === "locked"
              ? "Fora do acesso"
              : "Próxima"}
      </p>
    </div>
  );
}

function QuickAccessLink({ card }: { card: QuickAccessCard }) {
  const Icon = ACCESS_ICON[card.id];
  return (
    <Link
      href={card.href}
      className="group flex items-start gap-3 rounded-xl border border-border bg-surface p-4 transition-colors hover:border-cta/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cta"
    >
      <span className="mt-0.5 rounded-md border border-border p-2 text-cta" aria-hidden>
        <Icon className="size-4" />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-medium text-foreground">{card.title}</span>
        <span className="mt-1 block truncate text-sm text-muted">{card.detail}</span>
      </span>
      <ArrowRight className="ml-auto mt-1 size-4 shrink-0 text-muted group-hover:text-cta" aria-hidden />
    </Link>
  );
}

function MilestoneChip({ item }: { item: MilestoneView }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs ${
        item.unlocked ? "border-border bg-surface text-foreground" : "border-border/70 text-muted"
      }`}
      aria-label={item.unlocked ? `${item.label}, conquistado` : `${item.label}, ainda não conquistado`}
    >
      {item.unlocked ? <Check className="size-3.5 text-cta" aria-hidden /> : <span aria-hidden>○</span>}
      {item.label}
    </span>
  );
}
