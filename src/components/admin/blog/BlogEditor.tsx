"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BLOG_CATEGORIES, BLOG_CTA_KEYS } from "@/lib/blog/catalog";
import { editorialAction, publishBlogAction, saveBlogAction, unpublishBlogAction } from "@/lib/blog/actions";

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

export function BlogEditor({ initial = EMPTY }: { initial?: BlogEditorValue }) {
  const router = useRouter();
  const [post, setPost] = useState(initial);
  const [message, setMessage] = useState("");
  const [assist, setAssist] = useState("");
  const [pending, setPending] = useState(false);

  function formData(extra?: File | null) {
    const data = new FormData();
    for (const [key, value] of Object.entries(post)) {
      if (typeof value === "string") data.set(key, value);
    }
    if (extra) data.set("cover", extra);
    return data;
  }

  async function persist(intent: "save" | "publish") {
    setPending(true);
    setMessage("");
    const file = (document.getElementById("cover") as HTMLInputElement | null)?.files?.[0] ?? null;
    const result = intent === "publish" ? await publishBlogAction(post.id, formData(file)) : await saveBlogAction(post.id, formData(file));
    setPending(false);
    if (!result.ok) {
      setMessage(result.message);
      return;
    }
    setMessage(intent === "publish" ? "Artigo publicado." : "Rascunho salvo.");
    if (!post.id) router.push(`/admin/blog/${result.post.id}`);
    else router.refresh();
  }

  async function unpublish() {
    if (!post.id) return;
    setPending(true);
    const result = await unpublishBlogAction(post.id);
    setPending(false);
    setMessage(result.ok ? "Artigo despublicado. A data da primeira publicação foi mantida." : result.message);
    if (result.ok) router.refresh();
  }

  async function assistWith(action: "titles" | "outline" | "draft" | "review" | "seo") {
    setPending(true);
    setAssist("");
    const result = await editorialAction(action, {
      title: post.title,
      categorySlug: post.categorySlug,
      excerpt: post.excerpt,
      markdown: post.contentMarkdown,
      seoTitle: post.seoTitle,
      seoDescription: post.seoDescription,
      ctaKey: post.ctaKey,
    });
    setPending(false);
    if (!result.ok) {
      setMessage(result.message);
      return;
    }
    if (result.action === "titles") setAssist(result.titles.map((title) => `• ${title}`).join("\n"));
    else if (result.action === "draft") {
      setPost((current) => ({ ...current, contentMarkdown: result.markdown }));
      setAssist("O rascunho entrou no editor. Ele ainda não foi salvo.");
    } else if (result.action === "outline") setAssist(JSON.stringify(result.sections, null, 2));
    else if (result.action === "review" || result.action === "seo") setAssist(JSON.stringify(result.value, null, 2));
  }

  return (
    <form className="mt-8 grid max-w-3xl gap-4" onSubmit={(event) => event.preventDefault()}>
      <Field label="Título" value={post.title} onChange={(title) => setPost({ ...post, title })} name="title" />
      <Field label="Slug" value={post.slug} onChange={(slug) => setPost({ ...post, slug })} name="slug" readOnly={post.slugLocked} note={post.slugLocked ? "O slug permanece o da primeira publicação." : undefined} />
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
        <input id="cover" name="cover" type="file" accept="image/jpeg,image/png,image/webp" className="text-sm" />
      </label>
      {post.coverImageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={post.coverImageUrl} alt={post.coverImageAlt || ""} className="max-h-40 rounded-md object-cover" />
      ) : null}
      <Field label="Texto alternativo da capa" value={post.coverImageAlt} onChange={(coverImageAlt) => setPost({ ...post, coverImageAlt })} name="coverImageAlt" />
      <div className="flex flex-wrap gap-2">
        <button type="button" className="rounded-md border border-foreground px-3 py-2 text-sm" disabled={pending} onClick={() => persist("save")}>Salvar rascunho</button>
        <button type="button" className="rounded-md border border-foreground px-3 py-2 text-sm" disabled={pending} onClick={() => persist("publish")}>Publicar</button>
        {post.status === "PUBLISHED" && post.id ? <button type="button" className="rounded-md border border-border px-3 py-2 text-sm" disabled={pending} onClick={unpublish}>Despublicar</button> : null}
        {post.id ? <a className="rounded-md border border-border px-3 py-2 text-sm" href={`/admin/blog/${post.id}/preview`}>Pré-visualizar</a> : null}
      </div>
      <div className="flex flex-wrap gap-2">
        <AssistButton pending={pending} onClick={() => assistWith("titles")}>Sugerir títulos</AssistButton>
        <AssistButton pending={pending} onClick={() => assistWith("outline")}>Criar estrutura</AssistButton>
        <AssistButton pending={pending} onClick={() => assistWith("draft")}>Gerar rascunho com IA</AssistButton>
        <AssistButton pending={pending} onClick={() => assistWith("review")}>Revisar conteúdo</AssistButton>
        <AssistButton pending={pending} onClick={() => assistWith("seo")}>Revisar SEO</AssistButton>
      </div>
      {message ? <p className="text-sm" role="status">{message}</p> : null}
      {assist ? <pre className="overflow-x-auto whitespace-pre-wrap rounded-lg border border-border p-4 text-sm">{assist}</pre> : null}
    </form>
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
