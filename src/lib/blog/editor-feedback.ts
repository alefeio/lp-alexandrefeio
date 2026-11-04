import { EDITORIAL_IMAGE_LIMIT_BYTES } from "@/lib/storage/image-file";
import { formatByteSize, imageOptimizationNote, type ImageOptimizationReport } from "@/lib/storage/image-optimization-note";

const CLIENT_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export type BlogPendingAction = "save" | "publish" | "unpublish" | "titles" | "outline" | "draft" | "review" | "seo";

export type BlogEditorStatus = "DRAFT" | "PUBLISHED" | null;

export type BlogEditorNotice = "saved" | "published";

export type BlogEditorFeedback = {
  tone: "success" | "error";
  message: string;
};

const SELECTED_COVER_MESSAGE = "Imagem selecionada. Ela será enviada quando você salvar ou publicar.";

export function assessClientCoverFile(file: { type: string; size: number }): { ok: true } | { ok: false; message: string } {
  const type = file.type.trim().toLowerCase();
  if (!CLIENT_IMAGE_TYPES.has(type)) return { ok: false, message: "Use uma imagem JPEG, PNG ou WebP." };
  if (!Number.isFinite(file.size) || file.size <= 0) return { ok: false, message: "O arquivo está vazio." };
  if (file.size > EDITORIAL_IMAGE_LIMIT_BYTES) return { ok: false, message: "A imagem passa de 5 MB. Escolha uma imagem menor." };
  return { ok: true };
}

export { formatByteSize };

export function clientCoverSelection(file: { name: string; type: string; size: number }):
  | { ok: true; name: string; sizeLabel: string; message: string }
  | { ok: false; message: string } {
  const assessed = assessClientCoverFile(file);
  if (!assessed.ok) return assessed;
  return { ok: true, name: file.name, sizeLabel: formatByteSize(file.size), message: SELECTED_COVER_MESSAGE };
}

export function blogSaveLabel(status: BlogEditorStatus, pending: BlogPendingAction | null): string {
  if (pending === "save") return "Salvando...";
  return status === "PUBLISHED" ? "Salvar alterações" : "Salvar rascunho";
}

export function blogPublishLabel(pending: BlogPendingAction | null): string {
  return pending === "publish" ? "Publicando..." : "Publicar";
}

export function blogUnpublishLabel(pending: BlogPendingAction | null): string {
  return pending === "unpublish" ? "Despublicando..." : "Despublicar";
}

export function blogSuccessMessage(intent: "save" | "publish" | "unpublish", status: BlogEditorStatus): string {
  if (intent === "publish") return "Artigo publicado.";
  if (intent === "unpublish") return "Artigo despublicado. A data da primeira publicação foi mantida.";
  if (status === "PUBLISHED") return "Alterações salvas.";
  return "Rascunho salvo.";
}

export function blogTransportMessage(intent: "save" | "publish" | "unpublish"): string {
  if (intent === "publish") return "Não foi possível publicar o artigo. Tente novamente.";
  if (intent === "unpublish") return "Não foi possível despublicar o artigo. Tente novamente.";
  return "Não foi possível salvar o artigo. Tente novamente.";
}

export function blogNoticeFromQuery(value: string | string[] | undefined): BlogEditorNotice | null {
  const notice = Array.isArray(value) ? value[0] : value;
  if (notice === "saved" || notice === "published") return notice;
  return null;
}

export function blogNoticeFeedback(notice: BlogEditorNotice, status: Exclude<BlogEditorStatus, null>): BlogEditorFeedback {
  return { tone: "success", message: blogSuccessMessage(notice === "published" ? "publish" : "save", status) };
}

export function blogPersistFeedback(input: {
  intent: "save" | "publish";
  status: BlogEditorStatus;
  isNew: boolean;
  result: { ok: true; post: { id: string }; coverOptimization?: ImageOptimizationReport | null } | { ok: false; message: string } | { thrown: true };
}): BlogEditorFeedback & { href: string | null } {
  if ("thrown" in input.result) return { tone: "error", message: blogTransportMessage(input.intent), href: null };
  if (!input.result.ok) return { tone: "error", message: input.result.message, href: null };
  const note = input.result.coverOptimization ? ` Capa: ${imageOptimizationNote(input.result.coverOptimization)}` : "";
  const message = `${blogSuccessMessage(input.intent, input.status)}${note}`;
  if (!input.isNew) return { tone: "success", message, href: null };
  const notice: BlogEditorNotice = input.intent === "publish" ? "published" : "saved";
  return { tone: "success", message, href: `/admin/blog/${input.result.post.id}?notice=${notice}` };
}

export async function runGuardedBlogAction<T>(input: {
  gate: { current: BlogPendingAction | null };
  action: BlogPendingAction;
  setPending: (value: BlogPendingAction | null) => void;
  run: () => Promise<T>;
}): Promise<{ started: false } | { started: true; ok: true; value: T } | { started: true; ok: false }> {
  if (input.gate.current) return { started: false };
  input.gate.current = input.action;
  input.setPending(input.action);
  try {
    const value = await input.run();
    return { started: true, ok: true, value };
  } catch {
    return { started: true, ok: false };
  } finally {
    input.gate.current = null;
    input.setPending(null);
  }
}
