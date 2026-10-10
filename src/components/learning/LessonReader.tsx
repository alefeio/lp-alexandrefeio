"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { trackEvent } from "@/lib/analytics";
import { CONSENT_STORAGE_KEY, parseConsent } from "@/lib/consent";
import {
  deleteNote,
  gradeCheckpoint,
  importLocalProgress,
  saveActivity,
  saveCheckpoint,
  saveChecklist,
  saveLessonResult,
  saveNote,
  saveViewedBlocks,
  toggleBookmark,
} from "@/lib/learning/actions";
import { lessonAnalyticsEntries, lessonAnalyticsPayload } from "@/lib/learning/analytics-events";
import { lessonEventDedupeKey } from "@/lib/learning/analytics-events";
import { furthestBlockKey, readLocalProgress, writeLocalProgress, type LocalLessonProgress } from "@/lib/learning/local-progress";
import { isViewCompletedType, lessonProgressEvents, remainingMinutes, type CheckpointFeedback } from "@/lib/learning/progress";
import type { LessonSnapshot, ReaderBlock, ReaderLesson } from "@/lib/learning/reader-types";
import { buttonClass } from "@/lib/button-styles";

type Props = {
  lesson: ReaderLesson;
  blocks: ReaderBlock[];
  initial: LessonSnapshot;
  initialFeedback?: CheckpointFeedback;
  authenticated: boolean;
  resume: boolean;
};

export function LessonReader({ lesson, blocks, initial, initialFeedback = {}, authenticated, resume }: Props) {
  const [snapshot, setSnapshot] = useState(initial);
  const [explanations, setExplanations] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      Object.entries(initialFeedback)
        .filter((entry): entry is [string, { correct: boolean; explanation: string }] => Boolean(entry[1].explanation))
        .map(([key, value]) => [key, value.explanation]),
    ),
  );
  const [grades, setGrades] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(Object.entries(initialFeedback).map(([key, value]) => [key, value.correct])),
  );
  const [message, setMessage] = useState<string | null>(null);
  const [currentKey, setCurrentKey] = useState<string | null>(initial.lastBlockKey);
  const [pending, startTransition] = useTransition();
  const seen = useRef(new Set(initial.completedBlockKeys));
  const percentRef = useRef(initial.percent);
  const resumed = useRef(false);

  const headings = useMemo(() => blocks.filter((block) => block.data.type === "HEADING"), [blocks]);
  const currentHeading = useMemo(() => {
    const current = blocks.find((block) => block.blockKey === currentKey);
    if (!current) return headings[0]?.blockKey ?? null;
    const previous = [...headings].reverse().find((heading) => heading.position <= current.position);
    return previous?.blockKey ?? headings[0]?.blockKey ?? null;
  }, [blocks, currentKey, headings]);

  useEffect(() => {
    if (authenticated) {
      const local = readLocalProgress(lesson.slug);
      if (!local) return;
      startTransition(async () => {
        const result = await importLocalProgress(lesson.slug, local);
        if (result.ok) setSnapshot(result.snapshot);
      });
      return;
    }

    const local = readLocalProgress(lesson.slug);
    if (!local) return;
    const completed = savedKeys(blocks, local);
    const timer = window.setTimeout(() => {
      setSnapshot((current) => applyLocal(current, blocks, local, completed));
    }, 0);
    for (const [key, response] of Object.entries(local.responses)) {
      const optionId = response && typeof response === "object" && "optionId" in response ? String(response.optionId) : "";
      if (!optionId) continue;
      void gradeCheckpoint(lesson.slug, key, optionId).then((result) => {
        if (!result.ok) return;
        setGrades((current) => ({ ...current, [key]: result.correct }));
        if (result.explanation) setExplanations((current) => ({ ...current, [key]: result.explanation as string }));
        if (result.correct) {
          setSnapshot((current) => withCompleted(current, blocks, key));
        }
      });
    }
    return () => window.clearTimeout(timer);
  }, [authenticated, blocks, lesson.slug]);

  useEffect(() => {
    if (!resume || resumed.current || !initial.lastBlockKey) return;
    resumed.current = true;
    scrollToBlock(initial.lastBlockKey);
  }, [resume, initial.lastBlockKey]);

  useEffect(() => {
    trackLesson(lesson, "lesson_started");
  }, [lesson]);

  useEffect(() => {
    const events = lessonProgressEvents(percentRef.current, snapshot.percent);
    percentRef.current = snapshot.percent;
    for (const item of events) trackLesson(lesson, item.event, item.bucket);
  }, [lesson, snapshot.percent]);

  useEffect(() => {
    const pendingKeys = new Set<string>();
    const nodes = [...document.querySelectorAll<HTMLElement>("[data-block-key]")];
    if (nodes.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const key = entry.target.getAttribute("data-block-key");
          if (!key) continue;
          setCurrentKey(key);
          const block = blocks.find((item) => item.blockKey === key);
          if (!block || !isViewCompletedType(block.data.type) || seen.current.has(key)) continue;
          pendingKeys.add(key);
        }
      },
      { threshold: 0.6 },
    );

    for (const node of nodes) observer.observe(node);
    const timer = window.setInterval(() => {
      if (pendingKeys.size === 0) return;
      const keys = [...pendingKeys];
      pendingKeys.clear();
      for (const key of keys) seen.current.add(key);
      if (authenticated) {
        startTransition(async () => {
          const result = await saveViewedBlocks(lesson.slug, keys);
          if (result.ok) setSnapshot(result.snapshot);
        });
      } else {
        setSnapshot((current) => {
          const next = markViewed(current, blocks, keys);
          remember(lesson.slug, next);
          return next;
        });
      }
    }, 1500);

    return () => {
      observer.disconnect();
      window.clearInterval(timer);
    };
  }, [authenticated, blocks, lesson.slug]);

  function onCheckpoint(blockKey: string, optionId: string) {
    setMessage(null);
    startTransition(async () => {
      if (authenticated) {
        const result = await saveCheckpoint(lesson.slug, blockKey, optionId);
        if (!result.ok) {
          setMessage(result.message);
          return;
        }
        setSnapshot(result.snapshot);
        setGrades((current) => ({ ...current, [blockKey]: result.correct === true }));
        if (result.explanation) setExplanations((current) => ({ ...current, [blockKey]: result.explanation as string }));
        return;
      }
      const result = await gradeCheckpoint(lesson.slug, blockKey, optionId);
      if (!result.ok) {
        setMessage(result.message);
        return;
      }
      setGrades((current) => ({ ...current, [blockKey]: result.correct }));
      const explanation = result.explanation;
      if (explanation) setExplanations((current) => ({ ...current, [blockKey]: explanation }));
      setSnapshot((current) => {
        const next = {
          ...current,
          lastBlockKey: advanceKey(blocks, current.lastBlockKey, blockKey),
          responses: { ...current.responses, [blockKey]: { optionId } },
        };
        const completed = result.correct ? withCompleted(next, blocks, blockKey) : withoutCompleted(next, blocks, blockKey);
        remember(lesson.slug, completed);
        return completed;
      });
    });
  }

  function onActivity(blockKey: string, text: string) {
    setMessage(null);
    if (!authenticated) {
      setSnapshot((current) => {
        const next = withCompleted(
          {
            ...current,
            lastBlockKey: advanceKey(blocks, current.lastBlockKey, blockKey),
            responses: { ...current.responses, [blockKey]: { text } },
          },
          blocks,
          blockKey,
        );
        remember(lesson.slug, next);
        return next;
      });
      return;
    }
    startTransition(async () => {
      const result = await saveActivity(lesson.slug, blockKey, text);
      if (!result.ok) setMessage(result.message);
      else setSnapshot(result.snapshot);
    });
  }

  function onChecklist(blockKey: string, checkedIds: string[], complete: boolean) {
    setMessage(null);
    if (!authenticated) {
      setSnapshot((current) => {
        const base = {
          ...current,
          lastBlockKey: advanceKey(blocks, current.lastBlockKey, blockKey),
          responses: { ...current.responses, [blockKey]: { checkedIds } },
        };
        const next = complete ? withCompleted(base, blocks, blockKey) : base;
        remember(lesson.slug, next);
        return next;
      });
      return;
    }
    startTransition(async () => {
      const result = await saveChecklist(lesson.slug, blockKey, checkedIds);
      if (!result.ok) setMessage(result.message);
      else setSnapshot(result.snapshot);
    });
  }

  function onResult(values: Record<string, string>, blockKey: string) {
    setMessage(null);
    if (!authenticated) {
      setSnapshot((current) => {
        const next = withCompleted(
          { ...current, lastBlockKey: advanceKey(blocks, current.lastBlockKey, blockKey), result: values },
          blocks,
          blockKey,
        );
        remember(lesson.slug, next);
        return next;
      });
      return;
    }
    startTransition(async () => {
      const result = await saveLessonResult(lesson.slug, values);
      if (!result.ok) setMessage(result.message);
      else setSnapshot(result.snapshot);
    });
  }

  function onNote(blockKey: string, body: string) {
    if (!authenticated) return;
    startTransition(async () => {
      const result = body.trim() ? await saveNote(lesson.slug, blockKey, body) : await deleteNote(lesson.slug, blockKey);
      if (!result.ok) setMessage(result.message);
      else setSnapshot(result.snapshot);
    });
  }

  function onBookmark(blockKey: string) {
    if (!authenticated) return;
    startTransition(async () => {
      const result = await toggleBookmark(lesson.slug, blockKey);
      if (!result.ok) setMessage(result.message);
      else setSnapshot(result.snapshot);
    });
  }

  const resumeSection = useMemo(() => sectionName(blocks, headings, snapshot.lastBlockKey), [blocks, headings, snapshot.lastBlockKey]);
  const requiredLeft = blocks.filter((block) => block.required && !snapshot.completedBlockKeys.includes(block.blockKey)).length;
  const remaining = remainingMinutes(lesson.estimatedMinutes, snapshot.percent, snapshot.completed);

  return (
    <div className="mx-auto grid w-full max-w-6xl gap-10 px-5 py-10 sm:px-8 lg:grid-cols-[16rem_minmax(0,1fr)] lg:py-14">
      <LessonIndex headings={headings} current={currentHeading} onJump={scrollToBlock} />
      <article className="min-w-0 max-w-[40rem]">
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-cta">{lesson.moduleTitle}</p>
        <h1 className="mt-3 text-[1.85rem] font-semibold leading-[1.15] tracking-tight sm:text-4xl">{lesson.title}</h1>
        <p className="mt-4 text-[1.0625rem] leading-[1.7] text-muted">{lesson.summary}</p>
        <p className="mt-4 text-sm leading-relaxed text-muted">
          {lesson.estimatedMinutes ? `${lesson.estimatedMinutes} min de leitura` : "Leitura"}
          {snapshot.completed ? " · aula concluída" : ` · ${snapshot.percent}% do conteúdo percorrido`}
          {!snapshot.completed && requiredLeft > 0
            ? ` · ${requiredLeft === 1 ? "falta 1 atividade para concluir" : `faltam ${requiredLeft} atividades para concluir`}`
            : ""}
          {remaining != null ? ` · cerca de ${remaining} min restantes` : ""}
        </p>
        <div
          className="mt-4 h-1.5 max-w-xs overflow-hidden rounded-full bg-border"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={snapshot.percent}
          aria-label="Conteúdo percorrido"
        >
          <div className="h-full bg-cta" style={{ width: `${snapshot.percent}%` }} />
        </div>
        {snapshot.lastBlockKey && !snapshot.completed ? (
          <div className="mt-6">
            <button type="button" className={buttonClass("secondary")} onClick={() => scrollToBlock(snapshot.lastBlockKey as string)}>
              Continuar de onde você parou
            </button>
            {resumeSection ? <p className="mt-2 text-sm text-muted">{resumeSection}</p> : null}
          </div>
        ) : null}
        {!authenticated ? (
          <p className="mt-6 text-sm leading-relaxed text-muted">
            Crie sua conta para salvar seu progresso e continuar em outros dispositivos.{" "}
            <Link className="text-foreground underline underline-offset-4" href={`/cadastro?next=/aulas/${lesson.slug}`}>
              Criar conta
            </Link>
          </p>
        ) : null}
        {message ? (
          <p className="mt-4 text-sm text-danger" role="status">
            {message}
          </p>
        ) : null}
        <div className="mt-12 space-y-12">
          {blocks.map((block) => (
            <BlockView
              key={block.blockKey}
              block={block}
              snapshot={snapshot}
              explanation={explanations[block.blockKey]}
              correct={grades[block.blockKey]}
              authenticated={authenticated}
              pending={pending}
              onCheckpoint={onCheckpoint}
              onActivity={onActivity}
              onChecklist={onChecklist}
              onResult={onResult}
              onNote={onNote}
              onBookmark={onBookmark}
            />
          ))}
        </div>
      </article>
    </div>
  );
}

function LessonIndex({
  headings,
  current,
  onJump,
}: {
  headings: ReaderBlock[];
  current: string | null;
  onJump: (key: string) => void;
}) {
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const currentIndex = headings.findIndex((heading) => heading.blockKey === current);

  function jump(key: string) {
    const details = detailsRef.current;
    if (details?.open && window.matchMedia("(max-width: 1023px)").matches) details.open = false;
    onJump(key);
  }

  const list = (
    <ol className="space-y-3 text-sm">
      {headings.map((heading, index) => {
        if (heading.data.type !== "HEADING") return null;
        const active = heading.blockKey === current;
        const state = active ? "Você está aqui" : currentIndex >= 0 && index < currentIndex ? "Já passou" : "Adiante";
        return (
          <li key={heading.blockKey}>
            <button
              type="button"
              className={active ? "text-left font-medium text-foreground" : "text-left text-muted"}
              onClick={() => jump(heading.blockKey)}
              aria-current={active ? "true" : undefined}
            >
              {heading.data.text}
              <span className="mt-0.5 block text-xs">{state}</span>
            </button>
          </li>
        );
      })}
    </ol>
  );

  return (
    <nav aria-label="Índice da aula" className="min-w-0">
      <details ref={detailsRef} className="rounded-lg border border-border p-4 lg:hidden">
        <summary className="cursor-pointer text-sm font-medium">Índice da aula</summary>
        <div className="mt-4">{list}</div>
      </details>
      <div className="sticky top-24 hidden lg:block">
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted">Nesta aula</p>
        <div className="mt-4">{list}</div>
      </div>
    </nav>
  );
}

function BlockView(props: {
  block: ReaderBlock;
  snapshot: LessonSnapshot;
  explanation?: string;
  correct?: boolean;
  authenticated: boolean;
  pending: boolean;
  onCheckpoint: (blockKey: string, optionId: string) => void;
  onActivity: (blockKey: string, text: string) => void;
  onChecklist: (blockKey: string, checkedIds: string[], complete: boolean) => void;
  onResult: (values: Record<string, string>, blockKey: string) => void;
  onNote: (blockKey: string, body: string) => void;
  onBookmark: (blockKey: string) => void;
}) {
  const { block, snapshot } = props;
  const done = snapshot.completedBlockKeys.includes(block.blockKey);
  const marked = snapshot.bookmarks.includes(block.blockKey);

  const showTask = block.required && interactiveType(block.data.type);

  return (
    <section id={`b-${block.blockKey}`} data-block-key={block.blockKey} tabIndex={-1} className="scroll-mt-28 border-t border-border pt-10 outline-none">
      {showTask || props.authenticated ? (
        <div className="mb-4 flex items-center justify-between gap-3 text-xs text-muted">
          {showTask ? <span>{done ? "Atividade feita" : "Atividade para concluir a aula"}</span> : <span />}
          {props.authenticated ? (
            <button
              type="button"
              className="underline underline-offset-4"
              aria-pressed={marked}
              onClick={() => props.onBookmark(block.blockKey)}
            >
              {marked ? "Marcado para revisar" : "Marcar para revisar"}
            </button>
          ) : null}
        </div>
      ) : null}
      <BlockBody {...props} />
      {props.authenticated ? (
        <NoteField
          blockKey={block.blockKey}
          initial={snapshot.notes[block.blockKey] ?? ""}
          pending={props.pending}
          onSave={props.onNote}
        />
      ) : null}
    </section>
  );
}

function BlockBody(props: {
  block: ReaderBlock;
  snapshot: LessonSnapshot;
  explanation?: string;
  correct?: boolean;
  pending: boolean;
  onCheckpoint: (blockKey: string, optionId: string) => void;
  onActivity: (blockKey: string, text: string) => void;
  onChecklist: (blockKey: string, checkedIds: string[], complete: boolean) => void;
  onResult: (values: Record<string, string>, blockKey: string) => void;
}) {
  const data = props.block.data;
  if (data.type === "HEADING") {
    const Tag = data.level === 2 ? "h2" : "h3";
    const className = data.level === 2 ? "text-[1.65rem] font-semibold leading-tight tracking-tight" : "text-xl font-semibold leading-snug tracking-tight";
    return <Tag className={className}>{data.text}</Tag>;
  }
  if (data.type === "TEXT" || data.type === "CONCLUSION") return <Prose body={data.body} />;
  if (data.type === "CALLOUT") {
    return (
      <aside className={`rounded-lg border border-border bg-surface px-5 py-5 ${data.tone === "warning" ? "border-l-2 border-l-danger" : data.tone === "tip" ? "border-l-2 border-l-cta" : ""}`}>
        {data.title ? <p className="font-medium text-foreground">{data.title}</p> : null}
        <div className={data.title ? "mt-2" : ""}>
          <Prose body={data.body} />
        </div>
      </aside>
    );
  }
  if (data.type === "EXAMPLE") {
    return (
      <aside className="rounded-lg border border-border px-5 py-5">
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-cta">Exemplo</p>
        {data.title ? <p className="mt-2 font-medium">{data.title}</p> : null}
        <div className="mt-2">
          <Prose body={data.body} />
        </div>
      </aside>
    );
  }
  if (data.type === "IMAGE") {
    return (
      // O endereço vem do bloco validado (https). O otimizador do Next fica para quando a imagem passar pelo APIMG.
      // eslint-disable-next-line @next/next/no-img-element
      <img src={data.url} alt={data.alt} className="h-auto w-full rounded-lg" />
    );
  }
  if (data.type === "CHECKPOINT") {
    return (
      <div className="rounded-lg border border-border bg-surface px-5 py-5">
        <CheckpointForm {...props} data={data} />
      </div>
    );
  }
  if (data.type === "ACTIVITY") {
    return (
      <div className="rounded-lg border border-border bg-surface px-5 py-5">
        <ActivityForm {...props} data={data} />
      </div>
    );
  }
  if (data.type === "CHECKLIST") {
    return (
      <div className="rounded-lg border border-border bg-surface px-5 py-5">
        <ChecklistForm {...props} data={data} />
      </div>
    );
  }
  if (data.type === "RESULT") {
    return (
      <div className="rounded-lg border border-border bg-surface px-5 py-5">
        <ResultForm {...props} data={data} />
      </div>
    );
  }
  return null;
}

function CheckpointForm({
  block,
  snapshot,
  data,
  explanation,
  correct,
  pending,
  onCheckpoint,
}: {
  block: ReaderBlock;
  snapshot: LessonSnapshot;
  data: Extract<ReaderBlock["data"], { type: "CHECKPOINT" }>;
  explanation?: string;
  correct?: boolean;
  pending: boolean;
  onCheckpoint: (blockKey: string, optionId: string) => void;
}) {
  const saved = snapshot.responses[block.blockKey];
  const selected = saved && typeof saved === "object" && "optionId" in saved ? String(saved.optionId) : "";
  return (
    <form
      key={selected}
      onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        const optionId = String(form.get("option") ?? "");
        if (optionId) onCheckpoint(block.blockKey, optionId);
      }}
    >
      <fieldset disabled={pending}>
        <legend className="text-[1.0625rem] font-medium leading-snug text-foreground">{data.question}</legend>
        <div className="mt-4 space-y-3">
          {data.options.map((option) => (
            <label key={option.id} className="flex items-start gap-3 text-base leading-relaxed">
              <input className="mt-1" type="radio" name="option" value={option.id} defaultChecked={selected === option.id} required />
              <span>{option.label}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <button className={`${buttonClass("secondary")} mt-4`} type="submit">
        {selected ? "Responder de novo" : "Responder"}
      </button>
      {explanation ? (
        <p className="mt-4 text-base leading-relaxed" role="status">
          <span className="font-medium text-foreground">{correct ? "Certo." : "Ainda não."}</span>{" "}
          <span className="text-muted">{explanation}</span>
        </p>
      ) : null}
      {explanation ? <p className="mt-2 text-sm leading-relaxed text-muted">Você pode escolher outra opção. Isto não é uma prova.</p> : null}
    </form>
  );
}

function ActivityForm({
  block,
  snapshot,
  data,
  pending,
  onActivity,
}: {
  block: ReaderBlock;
  snapshot: LessonSnapshot;
  data: Extract<ReaderBlock["data"], { type: "ACTIVITY" }>;
  pending: boolean;
  onActivity: (blockKey: string, text: string) => void;
}) {
  const saved = snapshot.responses[block.blockKey];
  const text = saved && typeof saved === "object" && "text" in saved ? String(saved.text) : "";
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        onActivity(block.blockKey, String(form.get("resposta") ?? ""));
      }}
    >
      <label className="text-[1.0625rem] font-medium leading-snug text-foreground" htmlFor={`activity-${block.blockKey}`}>
        {data.prompt}
      </label>
      <textarea
        id={`activity-${block.blockKey}`}
        name="resposta"
        required
        rows={data.inputType === "long_text" ? 6 : 4}
        defaultValue={text}
        key={text}
        placeholder={data.placeholder}
        className="mt-3 w-full rounded-lg border border-border bg-white px-3 py-3 text-base leading-relaxed"
      />
      <button className={`${buttonClass("secondary")} mt-4`} type="submit" disabled={pending}>
        Salvar resposta
      </button>
      {text.trim() ? (
        <p className="mt-3 text-sm text-foreground" role="status">
          Resposta salva.
        </p>
      ) : null}
    </form>
  );
}

function ChecklistForm({
  block,
  snapshot,
  data,
  pending,
  onChecklist,
}: {
  block: ReaderBlock;
  snapshot: LessonSnapshot;
  data: Extract<ReaderBlock["data"], { type: "CHECKLIST" }>;
  pending: boolean;
  onChecklist: (blockKey: string, checkedIds: string[], complete: boolean) => void;
}) {
  const saved = snapshot.responses[block.blockKey];
  const checked = saved && typeof saved === "object" && "checkedIds" in saved && Array.isArray(saved.checkedIds) ? saved.checkedIds.map(String) : [];
  return (
    <form
      key={checked.join("|")}
      onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        const ids = form.getAll("item").map(String);
        onChecklist(block.blockKey, ids, ids.length === data.items.length);
      }}
    >
      <fieldset disabled={pending}>
        <legend className="text-base font-medium">Antes de seguir</legend>
        <div className="mt-4 space-y-3">
          {data.items.map((item) => (
            <label key={item.id} className="flex items-start gap-3 text-base leading-relaxed">
              <input className="mt-1" type="checkbox" name="item" value={item.id} defaultChecked={checked.includes(item.id)} />
              <span>{item.label}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <button className={`${buttonClass("secondary")} mt-4`} type="submit">
        Salvar checklist
      </button>
      {checked.length > 0 ? (
        <p className="mt-3 text-sm text-foreground" role="status">
          Checklist salvo.
        </p>
      ) : null}
    </form>
  );
}

function ResultForm({
  block,
  snapshot,
  data,
  pending,
  onResult,
}: {
  block: ReaderBlock;
  snapshot: LessonSnapshot;
  data: Extract<ReaderBlock["data"], { type: "RESULT" }>;
  pending: boolean;
  onResult: (values: Record<string, string>, blockKey: string) => void;
}) {
  return (
    <form
      key={JSON.stringify(snapshot.result ?? {})}
      onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        const values: Record<string, string> = {};
        for (const field of data.fields) values[field.key] = String(form.get(field.key) ?? "");
        onResult(values, block.blockKey);
      }}
    >
      <h2 className="text-xl font-semibold tracking-tight">{data.title}</h2>
      <p className="mt-2 text-sm leading-relaxed text-muted">{data.prompt}</p>
      <div className="mt-4 space-y-4">
        {data.fields.map((field) => (
          <div key={field.key}>
            <label className="text-sm font-medium" htmlFor={`${block.blockKey}-${field.key}`}>
              {field.label}
            </label>
            <input
              id={`${block.blockKey}-${field.key}`}
              name={field.key}
              required
              defaultValue={snapshot.result?.[field.key] ?? ""}
              className="mt-2 w-full rounded-lg border border-border bg-white px-3 py-3 text-base"
            />
          </div>
        ))}
      </div>
      <button className={`${buttonClass("primary")} mt-4`} type="submit" disabled={pending}>
        Salvar resultado da aula
      </button>
      {snapshot.result ? (
        <p className="mt-3 text-sm text-foreground" role="status">
          Resultado salvo.
        </p>
      ) : null}
    </form>
  );
}

function NoteField({
  blockKey,
  initial,
  pending,
  onSave,
}: {
  blockKey: string;
  initial: string;
  pending: boolean;
  onSave: (blockKey: string, body: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const hasNote = initial.trim().length > 0;

  if (!editing && !hasNote) {
    return (
      <p className="mt-6">
        <button type="button" className="text-sm text-muted underline underline-offset-4" onClick={() => setEditing(true)}>
          Adicionar nota
        </button>
      </p>
    );
  }

  if (!editing && hasNote) {
    return (
      <div className="mt-6" aria-label="Nota privada">
        <p className="text-sm font-medium">Minha nota</p>
        <p className="mt-2 whitespace-pre-wrap text-base leading-relaxed text-foreground">{initial}</p>
        <div className="mt-3 flex gap-4">
          <button type="button" className="text-sm underline underline-offset-4" onClick={() => setEditing(true)}>
            Editar
          </button>
          <button type="button" className="text-sm underline underline-offset-4" onClick={() => onSave(blockKey, "")} disabled={pending}>
            Excluir
          </button>
        </div>
      </div>
    );
  }

  return (
    <form
      className="mt-6"
      aria-label="Nota privada"
      onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        onSave(blockKey, String(form.get("nota") ?? ""));
        setEditing(false);
      }}
    >
      <label className="text-sm font-medium" htmlFor={`nota-${blockKey}`}>
        {hasNote ? "Minha nota" : "Adicionar nota"}
      </label>
      <textarea
        id={`nota-${blockKey}`}
        name="nota"
        rows={3}
        required
        defaultValue={initial}
        className="mt-2 w-full rounded-lg border border-border bg-white px-3 py-3 text-base leading-relaxed"
      />
      <div className="mt-3 flex gap-3">
        <button className={buttonClass("secondary")} type="submit" disabled={pending}>
          Salvar nota
        </button>
        <button type="button" className="text-sm underline underline-offset-4" onClick={() => setEditing(false)}>
          Cancelar
        </button>
      </div>
    </form>
  );
}

function Prose({ body }: { body: string }) {
  return (
    <div className="space-y-5 text-[1.0625rem] leading-[1.75] text-foreground">
      {body.split(/\n\n+/).map((paragraph) => (
        <p key={paragraph.slice(0, 24)} className="break-words">
          {paragraph}
        </p>
      ))}
    </div>
  );
}

function savedKeys(blocks: ReaderBlock[], local: LocalLessonProgress) {
  const keys = new Set(local.viewedBlockKeys.filter((key) => viewKey(blocks, key)));
  for (const block of blocks) {
    const saved = local.responses[block.blockKey];
    if (block.data.type === "ACTIVITY") {
      const text = saved && typeof saved === "object" && "text" in saved ? String(saved.text).trim() : "";
      if (text) keys.add(block.blockKey);
    }
    if (block.data.type === "CHECKLIST") {
      const checked =
        saved && typeof saved === "object" && "checkedIds" in saved && Array.isArray(saved.checkedIds)
          ? saved.checkedIds.map(String)
          : [];
      if (block.data.items.length > 0 && block.data.items.every((item) => checked.includes(item.id))) keys.add(block.blockKey);
    }
    if (block.data.type === "RESULT" && local.result && block.data.fields.every((field) => (local.result?.[field.key] ?? "").trim())) {
      keys.add(block.blockKey);
    }
  }
  return keys;
}

function viewKey(blocks: ReaderBlock[], key: string) {
  const block = blocks.find((item) => item.blockKey === key);
  return Boolean(block && isViewCompletedType(block.data.type));
}

function percentFrom(blocks: ReaderBlock[], keys: string[]) {
  const counting = blocks.filter((block) => block.countsForProgress);
  if (counting.length === 0) return 0;
  const done = counting.filter((block) => keys.includes(block.blockKey)).length;
  return Math.round((done / counting.length) * 100);
}

function lessonLooksComplete(blocks: ReaderBlock[], completedKeys: string[]) {
  const counting = blocks.filter((block) => block.countsForProgress);
  if (counting.length === 0) return false;
  const countingDone = counting.every((block) => completedKeys.includes(block.blockKey));
  const requiredDone = blocks.filter((block) => block.required).every((block) => completedKeys.includes(block.blockKey));
  return countingDone && requiredDone;
}

function withoutCompleted(snapshot: LessonSnapshot, blocks: ReaderBlock[], key: string): LessonSnapshot {
  const completedBlockKeys = snapshot.completedBlockKeys.filter((item) => item !== key);
  return {
    ...snapshot,
    completedBlockKeys,
    percent: percentFrom(blocks, completedBlockKeys),
    completed: lessonLooksComplete(blocks, completedBlockKeys),
  };
}

function withCompleted(snapshot: LessonSnapshot, blocks: ReaderBlock[], key: string): LessonSnapshot {
  const completedBlockKeys = snapshot.completedBlockKeys.includes(key)
    ? snapshot.completedBlockKeys
    : [...snapshot.completedBlockKeys, key];
  const percent = percentFrom(blocks, completedBlockKeys);
  return {
    ...snapshot,
    completedBlockKeys,
    percent,
    completed: lessonLooksComplete(blocks, completedBlockKeys),
    lastBlockKey: advanceKey(blocks, snapshot.lastBlockKey, key),
  };
}

function markViewed(snapshot: LessonSnapshot, blocks: ReaderBlock[], keys: string[]): LessonSnapshot {
  let next: LessonSnapshot = {
    ...snapshot,
    viewedBlockKeys: [...new Set([...snapshot.viewedBlockKeys, ...keys])],
    lastBlockKey: furthestBlockKey(
      blocks.map((block) => block.blockKey),
      [snapshot.lastBlockKey, ...keys],
    ),
  };
  for (const key of keys) next = withCompleted(next, blocks, key);
  return next;
}

function applyLocal(
  snapshot: LessonSnapshot,
  blocks: ReaderBlock[],
  local: LocalLessonProgress,
  completed: Set<string>,
): LessonSnapshot {
  const completedBlockKeys = [...completed];
  return {
    ...snapshot,
    lastBlockKey: local.lastBlockKey,
    viewedBlockKeys: local.viewedBlockKeys,
    responses: local.responses,
    result: local.result,
    completedBlockKeys,
    percent: percentFrom(blocks, completedBlockKeys),
    completed: lessonLooksComplete(blocks, completedBlockKeys),
  };
}

function remember(slug: string, snapshot: LessonSnapshot) {
  writeLocalProgress(slug, {
    updatedAt: new Date().toISOString(),
    lastBlockKey: snapshot.lastBlockKey,
    viewedBlockKeys: snapshot.viewedBlockKeys,
    responses: snapshot.responses,
    result: snapshot.result,
  });
}

function advanceKey(blocks: ReaderBlock[], current: string | null, incoming: string | null) {
  return furthestBlockKey(
    blocks.map((block) => block.blockKey),
    [current, incoming],
  );
}

function sectionName(blocks: ReaderBlock[], headings: ReaderBlock[], blockKey: string | null) {
  if (!blockKey) return null;
  const current = blocks.find((block) => block.blockKey === blockKey);
  if (!current) return null;
  const heading = [...headings].reverse().find((item) => item.position <= current.position);
  return heading && heading.data.type === "HEADING" ? heading.data.text : null;
}

function interactiveType(type: ReaderBlock["data"]["type"]) {
  return type === "CHECKPOINT" || type === "ACTIVITY" || type === "CHECKLIST" || type === "RESULT";
}

function scrollToBlock(key: string) {
  const node = document.getElementById(`b-${key}`);
  if (!node) return;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  node.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  node.focus({ preventScroll: true });
}

function trackLesson(lesson: ReaderLesson, event: "lesson_started" | "lesson_progress" | "lesson_completed", bucket?: 25 | 50 | 75 | 100) {
  if (typeof window === "undefined") return;
  const consent = parseConsent(window.localStorage.getItem(CONSENT_STORAGE_KEY));
  if (!consent?.analytics) return;
  const storageKey = lessonEventDedupeKey(lesson.slug, event, bucket);
  if (window.sessionStorage.getItem(storageKey) || window.localStorage.getItem(storageKey)) {
    window.sessionStorage.setItem(storageKey, "1");
    window.localStorage.setItem(storageKey, "1");
    return;
  }
  window.sessionStorage.setItem(storageKey, "1");
  window.localStorage.setItem(storageKey, "1");
  trackEvent(
    event,
    lessonAnalyticsEntries(
      lessonAnalyticsPayload({
        lessonSlug: lesson.slug,
        courseSlug: lesson.courseSlug,
        accessType: lesson.accessType,
        progressBucket: bucket,
      }),
    ),
  );
}
