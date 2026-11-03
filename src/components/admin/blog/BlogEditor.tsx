"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { useRouter } from "next/navigation";
import { BLOG_CATEGORIES, BLOG_CTA_KEYS } from "@/lib/blog/catalog";
import { editorialAction, publishBlogAction, saveBlogAction, unpublishBlogAction } from "@/lib/blog/actions";
import {
  blogPersistFeedback,
  blogPublishLabel,
  blogSaveLabel,
  blogSuccessMessage,
  blogTransportMessage,
  blogUnpublishLabel,
  clientCoverSelection,
  runGuardedBlogAction,
  type BlogEditorFeedback,
  type BlogPendingAction,
} from "@/lib/blog/editor-feedback";

export type BlogEditorValue = {
  id: string | null;
  title: string;
  slug: string;
  excerpt: string;
  contentMarkdown: string;
  categorySlug: string;
  ctaKey: string;
  seoTitle: string;
  seoDescription: string;
  coverImageAlt: string;
  coverImageUrl: string | null;
  status: "DRAFT" | "PUBLISHED" | null;
  slugLocked: boolean;
};

const EMPTY: BlogEditorValue = {
  id: null,
  title: "",
  slug: "",
  excerpt: "",
  contentMarkdown: "",
  categorySlug: "",
  ctaKey: "NONE",
  seoTitle: "",
  seoDescription: "",
  coverImageAlt: "",
  coverImageUrl: null,
  status: null,
  slugLocked: false,
};

export function BlogEditor({ initial = EMPTY, initialFeedback = null }: { initial?: BlogEditorValue; initialFeedback?: BlogEditorFeedback | null }) {
  const router = useRouter();
  const [post, setPost] = useState(initial);
  const [feedback, setFeedback] = useState<BlogEditorFeedback | null>(initialFeedback);
  const [assist, setAssist] = useState("");
  const [pendingAction, setPendingAction] = useState<BlogPendingAction | null>(null);
  const [selectedCover, setSelectedCover] = useState<File | null>(null);
  const [coverPreviewUrl, setCoverPreviewUrl] = useState<string | null>(null);
  const [coverNote, setCoverNote] = useState<BlogEditorFeedback | null>(null);
  const [coverMeta, setCoverMeta] = useState<{ name: string; sizeLabel: string } | null>(null);
  const gate = useRef<BlogPendingAction | null>(null);
  const previewUrl = useRef<string | null>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const feedbackRef = useRef<HTMLParagraphElement>(null);
  const busy = pendingAction !== null;

  useEffect(() => {
    return () => {
      if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
    };
  }, []);

  useEffect(() => {
    if (feedback?.tone !== "error" && coverNote?.tone !== "error") return;
    feedbackRef.current?.focus({ preventScroll: true });
  }, [coverNote, feedback]);

  function formData(extra?: File | null) {
    const data = new FormData();
    for (const [key, value] of Object.entries(post)) {
      if (typeof value === "string") data.set(key, value);
    }
    if (extra) data.set("cover", extra);
    return data;
  }

  function replacePreview(file: File | null) {
    if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
    const next = file ? URL.createObjectURL(file) : null;
    previewUrl.current = next;
    setCoverPreviewUrl(next);
  }

  function clearSelectedCover() {
    setSelectedCover(null);
    setCoverMeta(null);
    replacePreview(null);
    setCoverNote(null);
    if (coverInputRef.current) coverInputRef.current.value = "";
  }

  function onCoverChange(file: File | null) {
    if (!file) {
      clearSelectedCover();
      return false;
    }
    const selection = clientCoverSelection(file);
    if (!selection.ok) {
      setSelectedCover(null);
      setCoverMeta(null);
      replacePreview(null);
      setCoverNote({ tone: "error", message: selection.message });
      return false;
    }
    setSelectedCover(file);
    setCoverMeta({ name: selection.name, sizeLabel: selection.sizeLabel });
    replacePreview(file);
    setCoverNote({ tone: "success", message: selection.message });
    return true;
  }

  async function persist(intent: "save" | "publish") {
    const outcome = await runGuardedBlogAction({
      gate,
      action: intent,
      setPending: setPendingAction,
      run: async () => {
        setFeedback(null);
        return intent === "publish" ? publishBlogAction(post.id, formData(selectedCover)) : saveBlogAction(post.id, formData(selectedCover));
      },
    });
    if (!outcome.started) return;
    const next = blogPersistFeedback({
      intent,
      status: initial.status,
      isNew: !post.id,
      result: outcome.ok ? outcome.value : { thrown: true },
    });
    if (outcome.ok && outcome.value.ok) clearSelectedCover();
    setFeedback(next);
    if (!next.href) {
      if (outcome.ok && outcome.value.ok) router.refresh();
      return;
    }
    router.push(next.href);
  }

  async function unpublish() {
    if (!post.id) return;
    const outcome = await runGuardedBlogAction({
      gate,
      action: "unpublish",
      setPending: setPendingAction,
      run: () => unpublishBlogAction(post.id as string),
    });
    if (!outcome.started) return;
    if (!outcome.ok) {
      setFeedback({ tone: "error", message: blogTransportMessage("unpublish") });
      return;
    }
    setFeedback({
      tone: outcome.value.ok ? "success" : "error",
      message: outcome.value.ok ? blogSuccessMessage("unpublish", initial.status) : outcome.value.message,
    });
    if (outcome.value.ok) router.refresh();
  }

  async function assistWith(action: "titles" | "outline" | "draft" | "review" | "seo") {
    const idempotencyKey = crypto.randomUUID();
    const outcome = await runGuardedBlogAction({
      gate,
      action,
      setPending: setPendingAction,
      run: () => editorialAction(action, {
        title: post.title,
        categorySlug: post.categorySlug,
        excerpt: post.excerpt,
        markdown: post.contentMarkdown,
        seoTitle: post.seoTitle,
        seoDescription: post.seoDescription,
        ctaKey: post.ctaKey,
      }, { idempotencyKey }),
    });
    if (!outcome.started) return;
    if (!outcome.ok) {
      setFeedback({ tone: "error", message: "Não foi possível concluir esta ação. Tente novamente." });
      return;
    }
    const result = outcome.value;
    if (!result.ok) {
      setFeedback({ tone: "error", message: result.message });
      return;
    }
    if (result.action === "titles") setAssist(result.titles.map((title) => `• ${title}`).join("\n"));
    else if (result.action === "draft") {
      setPost((current) => ({ ...current, contentMarkdown: result.markdown }));
      setAssist("O rascunho entrou no editor. Ele ainda não foi salvo.");
    } else if (result.action === "outline") setAssist(JSON.stringify(result.sections, null, 2));
    else if (result.action === "review" || result.action === "seo") setAssist(JSON.stringify(result.value, null, 2));
  }

  const coverLabel = coverPreviewUrl ? "Nova capa selecionada" : initial.coverImageUrl ? "Capa atual" : null;
  const coverSrc = coverPreviewUrl ?? initial.coverImageUrl;

  return (
    <form className="mt-8 grid max-w-3xl gap-4" aria-busy={busy} onSubmit={(event) => event.preventDefault()}>
      <Field label="Título" value={post.title} onChange={(title) => setPost({ ...post, title })} name="title" />
      <Field label="Slug" value={post.slug} onChange={(slug) => setPost({ ...post, slug })} name="slug" readOnly={initial.slugLocked} note={initial.slugLocked ? "O slug permanece o da primeira publicação." : undefined} />
      <label className="grid gap-1 text-sm">
        Categoria
        <select className="rounded-md border border-border bg-background px-3 py-2" value={post.categorySlug} onChange={(event) => setPost({ ...post, categorySlug: event.target.value })}>
          <option value="">Escolher</option>
          {BLOG_CATEGORIES.map((category) => <option key={category.slug} value={category.slug}>{category.label}</option>)}
        </select>
      </label>
      <Field label="Resumo" value={post.excerpt} onChange={(excerpt) => setPost({ ...post, excerpt })} name="excerpt" multiline />
      <Field label="Markdown" value={post.contentMarkdown} onChange={(contentMarkdown) => setPost({ ...post, contentMarkdown })} name="contentMarkdown" multiline tall />
      <label className="grid gap-1 text-sm">
        CTA
        <select className="rounded-md border border-border bg-background px-3 py-2" value={post.ctaKey} onChange={(event) => setPost({ ...post, ctaKey: event.target.value })}>
          {BLOG_CTA_KEYS.map((key) => <option key={key} value={key}>{key}</option>)}
        </select>
      </label>
      <Field label="Título de SEO" value={post.seoTitle} onChange={(seoTitle) => setPost({ ...post, seoTitle })} name="seoTitle" />
      <Field label="Descrição de SEO" value={post.seoDescription} onChange={(seoDescription) => setPost({ ...post, seoDescription })} name="seoDescription" />
      <label className="grid gap-1 text-sm">
        Capa
        <input
          ref={coverInputRef}
          id="cover"
          name="cover"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="text-sm"
          disabled={busy}
          onChange={(event) => {
            const file = event.target.files?.[0] ?? null;
            if (!onCoverChange(file)) event.target.value = "";
          }}
        />
      </label>
      {coverMeta ? (
        <p className="text-sm">
          <span className="block">{coverMeta.name}</span>
          <span className="block">{coverMeta.sizeLabel}</span>
        </p>
      ) : null}
      {coverNote ? <FeedbackView feedback={coverNote} targetRef={coverNote.tone === "error" ? feedbackRef : undefined} /> : null}
      {coverLabel && coverSrc ? (
        <figure className="grid gap-2">
          <figcaption className="text-sm">{coverLabel}</figcaption>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={coverSrc} alt={post.coverImageAlt || ""} className="max-h-40 rounded-md object-cover" />
        </figure>
      ) : null}
      <Field label="Texto alternativo da capa" value={post.coverImageAlt} onChange={(coverImageAlt) => setPost({ ...post, coverImageAlt })} name="coverImageAlt" />
      <div className="flex flex-wrap gap-2">
        <button type="button" className="rounded-md border border-foreground px-3 py-2 text-sm" disabled={busy} onClick={() => persist("save")}>{blogSaveLabel(initial.status, pendingAction)}</button>
        <button type="button" className="rounded-md border border-foreground px-3 py-2 text-sm" disabled={busy} onClick={() => persist("publish")}>{blogPublishLabel(pendingAction)}</button>
        {initial.status === "PUBLISHED" && post.id ? <button type="button" className="rounded-md border border-border px-3 py-2 text-sm" disabled={busy} onClick={unpublish}>{blogUnpublishLabel(pendingAction)}</button> : null}
        {post.id ? <a className="rounded-md border border-border px-3 py-2 text-sm" href={`/admin/blog/${post.id}/preview`}>Pré-visualizar</a> : null}
      </div>
      {feedback ? <FeedbackView feedback={feedback} targetRef={feedback.tone === "error" ? feedbackRef : undefined} /> : null}
      <div className="flex flex-wrap gap-2">
        <AssistButton pending={busy} onClick={() => assistWith("titles")}>Sugerir títulos</AssistButton>
        <AssistButton pending={busy} onClick={() => assistWith("outline")}>Criar estrutura</AssistButton>
        <AssistButton pending={busy} onClick={() => assistWith("draft")}>Gerar rascunho com IA</AssistButton>
        <AssistButton pending={busy} onClick={() => assistWith("review")}>Revisar conteúdo</AssistButton>
        <AssistButton pending={busy} onClick={() => assistWith("seo")}>Revisar SEO</AssistButton>
      </div>
      {assist ? <pre className="overflow-x-auto whitespace-pre-wrap rounded-lg border border-border p-4 text-sm">{assist}</pre> : null}
    </form>
  );
}

function FeedbackView({ feedback, targetRef }: { feedback: BlogEditorFeedback; targetRef?: RefObject<HTMLParagraphElement | null> }) {
  if (feedback.tone === "error") {
    return (
      <p ref={targetRef} tabIndex={-1} role="alert" className="text-sm focus:outline focus:outline-2 focus:outline-offset-2">
        {feedback.message}
      </p>
    );
  }
  return (
    <p role="status" aria-live="polite" className="text-sm">
      {feedback.message}
    </p>
  );
}

function Field({ label, value, onChange, name, multiline, tall, readOnly, note }: { label: string; value: string; onChange: (value: string) => void; name: string; multiline?: boolean; tall?: boolean; readOnly?: boolean; note?: string }) {
  const className = "rounded-md border border-border bg-background px-3 py-2";
  return (
    <label className="grid gap-1 text-sm">
      {label}
      {multiline ? (
        <textarea name={name} value={value} onChange={(event) => onChange(event.target.value)} className={`${className} ${tall ? "min-h-64" : "min-h-24"}`} />
      ) : (
        <input name={name} value={value} readOnly={readOnly} onChange={(event) => onChange(event.target.value)} className={className} />
      )}
      {note ? <span className="text-xs text-muted">{note}</span> : null}
    </label>
  );
}

function AssistButton({ children, onClick, pending }: { children: string; onClick: () => void; pending: boolean }) {
  return <button type="button" className="rounded-md border border-border px-3 py-2 text-sm" disabled={pending} onClick={onClick}>{children}</button>;
}
