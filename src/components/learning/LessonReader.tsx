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
import { isViewCompletedType } from "@/lib/learning/progress";
import { readLocalProgress, writeLocalProgress, type LocalLessonProgress } from "@/lib/learning/local-progress";
import { crossedProgressBuckets } from "@/lib/learning/progress";
import type { LessonSnapshot, ReaderBlock, ReaderLesson } from "@/lib/learning/reader-types";
import { buttonClass } from "@/lib/button-styles";

type Props = {
  lesson: ReaderLesson;
  blocks: ReaderBlock[];
  initial: LessonSnapshot;
  authenticated: boolean;
  resume: boolean;
};

export function LessonReader({ lesson, blocks, initial, authenticated, resume }: Props) {
  const [snapshot, setSnapshot] = useState(initial);
  const [explanations, setExplanations] = useState<Record<string, string>>({});
  const [grades, setGrades] = useState<Record<string, boolean>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [currentKey, setCurrentKey] = useState<string | null>(initial.lastBlockKey);
  const [pending, startTransition] = useTransition();
  const seen = useRef(new Set(initial.completedBlockKeys));
  const percentRef = useRef(initial.percent);

  const headings = blocks.filter((block) => block.data.type === "HEADING");
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
    const completed = new Set(local.viewedBlockKeys.filter((key) => viewKey(blocks, key)));
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
    if (!resume || !snapshot.lastBlockKey) return;
    scrollToBlock(snapshot.lastBlockKey);
  }, [resume, snapshot.lastBlockKey]);

  useEffect(() => {
    trackLesson(lesson, "lesson_started");
  }, [lesson]);

  useEffect(() => {
    const buckets = crossedProgressBuckets(percentRef.current, snapshot.percent);
    percentRef.current = snapshot.percent;
    for (const bucket of buckets) {
      if (bucket === 100) trackLesson(lesson, "lesson_completed", 100);
      else trackLesson(lesson, "lesson_progress", bucket);
    }
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
          lastBlockKey: blockKey,
          responses: { ...current.responses, [blockKey]: { optionId } },
        };
        const completed = result.correct ? withCompleted(next, blocks, blockKey) : next;
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
          { ...current, lastBlockKey: blockKey, responses: { ...current.responses, [blockKey]: { text } } },
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
          lastBlockKey: blockKey,
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
        const next = withCompleted({ ...current, lastBlockKey: blockKey, result: values }, blocks, blockKey);
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

  return (
    <div className="mx-auto grid w-full max-w-6xl gap-10 px-5 py-10 sm:px-8 lg:grid-cols-[16rem_minmax(0,1fr)] lg:py-14">
      <LessonIndex
        headings={headings}
        current={currentHeading}
        completed={snapshot.completedBlockKeys}
        onJump={scrollToBlock}
      />
      <article className="min-w-0">
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-cta">{lesson.moduleTitle}</p>
        <h1 className="mt-3 text-[1.85rem] font-semibold leading-[1.15] tracking-tight sm:text-4xl">{lesson.title}</h1>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted">{lesson.summary}</p>
        <p className="mt-3 text-sm text-muted">
          {lesson.estimatedMinutes ? `${lesson.estimatedMinutes} min de leitura` : "Leitura"} · {snapshot.percent}% da aula
          {snapshot.completed ? " · concluída" : ""}
        </p>
        <div
          className="mt-4 h-1.5 max-w-xs overflow-hidden rounded-full bg-surface"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={snapshot.percent}
          aria-label="Progresso da aula"
        >
          <div className="h-full bg-cta" style={{ width: `${snapshot.percent}%` }} />
        </div>
        {snapshot.lastBlockKey && !snapshot.completed ? (
          <p className="mt-6">
            <button type="button" className={buttonClass("secondary")} onClick={() => scrollToBlock(snapshot.lastBlockKey as string)}>
              Continuar de onde você parou
            </button>
          </p>
        ) : null}
        {!authenticated ? (
          <p className="mt-6 max-w-2xl text-sm leading-relaxed text-muted">
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
        <div className="mt-10 max-w-2xl space-y-8">
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
  completed,
  onJump,
}: {
  headings: ReaderBlock[];
  current: string | null;
  completed: string[];
  onJump: (key: string) => void;
}) {
  const list = (
    <ol className="space-y-2 text-sm">
      {headings.map((heading) => {
        if (heading.data.type !== "HEADING") return null;
        const done = completed.includes(heading.blockKey);
        const active = heading.blockKey === current;
        return (
          <li key={heading.blockKey}>
            <button
              type="button"
              className={active ? "text-left font-medium text-foreground" : "text-left text-muted"}
              onClick={() => onJump(heading.blockKey)}
              aria-current={active ? "true" : undefined}
            >
              {heading.data.text}
              <span className="mt-0.5 block text-xs">{done ? "Concluído" : active ? "Seção atual" : "Pendente"}</span>
            </button>
          </li>
        );
      })}
    </ol>
  );

  return (
    <nav aria-label="Índice da aula" className="min-w-0">
      <details className="rounded-lg border border-border p-4 lg:hidden">
        <summary className="cursor-pointer text-sm font-medium">Índice da aula</summary>
        <div className="mt-4">{list}</div>
      </details>
      <div className="sticky top-6 hidden lg:block">
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

  return (
    <section id={`b-${block.blockKey}`} data-block-key={block.blockKey} className="scroll-mt-24 border-t border-border pt-8">
      <div className="mb-3 flex items-center justify-between gap-3 text-xs text-muted">
        <span>{done ? "Concluído" : "Pendente"}</span>
        {props.authenticated ? (
          <button type="button" className="underline underline-offset-4" onClick={() => props.onBookmark(block.blockKey)}>
            {marked ? "Marcado" : "Marcar"}
          </button>
        ) : null}
      </div>
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
    return <Tag className="text-2xl font-semibold tracking-tight">{data.text}</Tag>;
  }
  if (data.type === "TEXT" || data.type === "CONCLUSION") return <Prose body={data.body} />;
  if (data.type === "CALLOUT") {
    return (
      <aside className="rounded-lg border border-border bg-surface px-4 py-4">
        {data.title ? <p className="font-medium text-foreground">{data.title}</p> : null}
        <div className={data.title ? "mt-2" : ""}>
          <Prose body={data.body} />
        </div>
      </aside>
    );
  }
  if (data.type === "EXAMPLE") {
    return (
      <aside className="rounded-lg border border-border px-4 py-4">
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
  if (data.type === "CHECKPOINT") return <CheckpointForm {...props} data={data} />;
  if (data.type === "ACTIVITY") return <ActivityForm {...props} data={data} />;
  if (data.type === "CHECKLIST") return <ChecklistForm {...props} data={data} />;
  if (data.type === "RESULT") return <ResultForm {...props} data={data} />;
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
      onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        const optionId = String(form.get("option") ?? "");
        if (optionId) onCheckpoint(block.blockKey, optionId);
      }}
    >
      <fieldset disabled={pending}>
        <legend className="text-base font-medium text-foreground">{data.question}</legend>
        <div className="mt-4 space-y-3">
          {data.options.map((option) => (
            <label key={option.id} className="flex items-start gap-3 text-sm leading-relaxed">
              <input className="mt-1" type="radio" name="option" value={option.id} defaultChecked={selected === option.id} required />
              <span>{option.label}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <button className={`${buttonClass("secondary")} mt-4`} type="submit">
        Responder
      </button>
      {explanation ? (
        <p className="mt-4 text-sm leading-relaxed text-muted" role="status">
          {correct ? "Certo. " : "Ainda não. "}
          {explanation}
        </p>
      ) : null}
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
      <label className="text-base font-medium text-foreground" htmlFor={`activity-${block.blockKey}`}>
        {data.prompt}
      </label>
      <textarea
        id={`activity-${block.blockKey}`}
        name="resposta"
        required
        rows={data.inputType === "long_text" ? 6 : 3}
        defaultValue={text}
        placeholder={data.placeholder}
        className="mt-3 w-full rounded-lg border border-border bg-white px-3 py-3 text-sm"
      />
      <button className={`${buttonClass("secondary")} mt-4`} type="submit" disabled={pending}>
        Salvar resposta
      </button>
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
            <label key={item.id} className="flex items-start gap-3 text-sm leading-relaxed">
              <input className="mt-1" type="checkbox" name="item" value={item.id} defaultChecked={checked.includes(item.id)} />
              <span>{item.label}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <button className={`${buttonClass("secondary")} mt-4`} type="submit">
        Salvar checklist
      </button>
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
              className="mt-2 w-full rounded-lg border border-border bg-white px-3 py-3 text-sm"
            />
          </div>
        ))}
      </div>
      <button className={`${buttonClass("primary")} mt-4`} type="submit" disabled={pending}>
        Salvar resultado da aula
      </button>
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
  return (
    <form
      className="mt-6"
      onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        onSave(blockKey, String(form.get("nota") ?? ""));
      }}
    >
      <label className="text-sm font-medium" htmlFor={`nota-${blockKey}`}>
        Nota privada
      </label>
      <textarea id={`nota-${blockKey}`} name="nota" rows={3} defaultValue={initial} className="mt-2 w-full rounded-lg border border-border bg-white px-3 py-3 text-sm" />
      <button className={`${buttonClass("secondary")} mt-3`} type="submit" disabled={pending}>
        Salvar nota
      </button>
    </form>
  );
}

function Prose({ body }: { body: string }) {
  return (
    <div className="space-y-4 text-base leading-relaxed text-muted">
      {body.split(/\n\n+/).map((paragraph) => (
        <p key={paragraph.slice(0, 24)} className="break-words">
          {paragraph}
        </p>
      ))}
    </div>
  );
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

function withCompleted(snapshot: LessonSnapshot, blocks: ReaderBlock[], key: string): LessonSnapshot {
  const completedBlockKeys = snapshot.completedBlockKeys.includes(key)
    ? snapshot.completedBlockKeys
    : [...snapshot.completedBlockKeys, key];
  const percent = percentFrom(blocks, completedBlockKeys);
  return { ...snapshot, completedBlockKeys, percent, completed: percent === 100, lastBlockKey: key };
}

function markViewed(snapshot: LessonSnapshot, blocks: ReaderBlock[], keys: string[]): LessonSnapshot {
  let next: LessonSnapshot = {
    ...snapshot,
    viewedBlockKeys: [...new Set([...snapshot.viewedBlockKeys, ...keys])],
    lastBlockKey: keys[keys.length - 1] ?? snapshot.lastBlockKey,
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
    completed: percentFrom(blocks, completedBlockKeys) === 100,
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

function scrollToBlock(key: string) {
  const node = document.getElementById(`b-${key}`);
  if (!node) return;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  node.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
}

function trackLesson(lesson: ReaderLesson, event: "lesson_started" | "lesson_progress" | "lesson_completed", bucket?: 25 | 50 | 75 | 100) {
  if (typeof window === "undefined") return;
  const consent = parseConsent(window.localStorage.getItem(CONSENT_STORAGE_KEY));
  if (!consent?.analytics) return;
  const storageKey = event === "lesson_started" ? `af_lesson_started_${lesson.slug}` : `af_lesson_${event}_${lesson.slug}_${bucket}`;
  if (window.sessionStorage.getItem(storageKey)) return;
  window.sessionStorage.setItem(storageKey, "1");
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
