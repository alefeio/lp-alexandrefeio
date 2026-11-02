import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  assessClientCoverFile,
  blogNoticeFeedback,
  blogNoticeFromQuery,
  blogPersistFeedback,
  blogPublishLabel,
  blogSaveLabel,
  blogTransportMessage,
  blogUnpublishLabel,
  clientCoverSelection,
  runGuardedBlogAction,
  type BlogPendingAction,
} from "../src/lib/blog/editor-feedback";
import { EDITORIAL_IMAGE_LIMIT_BYTES, validateEditorialImage } from "../src/lib/storage/image-file";

test("a server action aceita a capa de 5 MB com margem, sem ampliar a imagem", () => {
  const config = readFileSync("next.config.ts", "utf8");
  assert.match(config, /bodySizeLimit:\s*"6mb"/);
  assert.equal(config.includes("50mb"), false);
  assert.equal(config.includes("100mb"), false);
  assert.equal(EDITORIAL_IMAGE_LIMIT_BYTES, 5 * 1024 * 1024);
  assert.match(readFileSync("src/lib/storage/image-file.ts", "utf8"), /EDITORIAL_IMAGE_LIMIT_BYTES = 5 \* 1024 \* 1024/);
});

test("o cliente aceita JPEG, PNG e WebP até 5 MB e recusa o resto antes do request", () => {
  assert.equal(assessClientCoverFile({ type: "image/jpeg", size: 1024 }).ok, true);
  assert.equal(assessClientCoverFile({ type: "image/png", size: EDITORIAL_IMAGE_LIMIT_BYTES }).ok, true);
  assert.equal(assessClientCoverFile({ type: "image/webp", size: 2048 }).ok, true);
  const huge = assessClientCoverFile({ type: "image/jpeg", size: EDITORIAL_IMAGE_LIMIT_BYTES + 1 });
  assert.equal(huge.ok, false);
  if (huge.ok) return;
  assert.equal(huge.message, "A imagem passa de 5 MB. Escolha uma imagem menor.");
  const gif = assessClientCoverFile({ type: "image/gif", size: 1024 });
  assert.equal(gif.ok, false);
  if (gif.ok) return;
  assert.equal(gif.message, "Use uma imagem JPEG, PNG ou WebP.");
  const selected = clientCoverSelection({ name: "capa.jpg", type: "image/jpeg", size: 1536 * 1024 });
  assert.equal(selected.ok, true);
  if (!selected.ok) return;
  assert.equal(selected.name, "capa.jpg");
  assert.match(selected.sizeLabel, /MB|KB/);
  assert.equal(selected.message, "Imagem selecionada. Ela será enviada quando você salvar ou publicar.");
  assert.equal(selected.message.includes("Imagem enviada"), false);
  assert.equal(selected.message.includes("Upload concluído"), false);
});

test("o servidor continua sendo a autoridade da imagem, além do type do browser", () => {
  const disguised = validateEditorialImage(new TextEncoder().encode("nao-e-imagem"), "image/jpeg", 12);
  assert.equal(disguised.ok, false);
  const oversized = validateEditorialImage(Uint8Array.of(0xff, 0xd8, 0xff), "image/jpeg", EDITORIAL_IMAGE_LIMIT_BYTES + 1);
  assert.equal(oversized.ok, false);
});

test("salvar e publicar mostram a ação em curso e liberam o pending ao terminar ou falhar", async () => {
  const gate = { current: null as BlogPendingAction | null };
  let pending: BlogPendingAction | null = null;
  let release: (value: string) => void = () => {};
  const first = runGuardedBlogAction({
    gate,
    action: "save",
    setPending: (value) => {
      pending = value;
    },
    run: () => new Promise<string>((resolve) => {
      release = resolve;
    }),
  });
  assert.equal(pending, "save");
  assert.equal(blogSaveLabel("DRAFT", pending), "Salvando...");
  assert.equal(blogPublishLabel(pending), "Publicar");
  let secondStarted = false;
  const second = await runGuardedBlogAction({
    gate,
    action: "publish",
    setPending: (value) => {
      pending = value;
    },
    run: async () => {
      secondStarted = true;
      return "nao";
    },
  });
  assert.equal(second.started, false);
  assert.equal(secondStarted, false);
  release("ok");
  const done = await first;
  assert.equal(done.started, true);
  assert.equal(done.ok, true);
  if (done.started && done.ok) assert.equal(done.value, "ok");
  assert.equal(pending, null);
  assert.equal(gate.current, null);

  let afterThrow: BlogPendingAction | null = "publish";
  const thrown = await runGuardedBlogAction({
    gate: { current: null },
    action: "publish",
    setPending: (value) => {
      afterThrow = value;
    },
    run: async () => {
      throw new Error("digest secret stack");
    },
  });
  assert.equal(thrown.started, true);
  assert.equal(thrown.ok, false);
  assert.equal(afterThrow, null);
  assert.equal(blogPublishLabel("publish"), "Publicando...");
  assert.equal(blogUnpublishLabel("unpublish"), "Despublicando...");
});

test("o feedback distingue validação, falha de transporte, salvamento e publicação", () => {
  const validation = blogPersistFeedback({
    intent: "publish",
    status: "DRAFT",
    isNew: false,
    result: { ok: false, message: "Para publicar, adicione uma imagem de capa." },
  });
  assert.equal(validation.tone, "error");
  assert.equal(validation.message, "Para publicar, adicione uma imagem de capa.");
  assert.equal(validation.href, null);

  const transport = blogPersistFeedback({ intent: "save", status: "DRAFT", isNew: false, result: { thrown: true } });
  assert.equal(transport.message, blogTransportMessage("save"));
  assert.equal(transport.message, "Não foi possível salvar o artigo. Tente novamente.");
  assert.equal(transport.message.includes("digest"), false);
  const publishTransport = blogPersistFeedback({ intent: "publish", status: "PUBLISHED", isNew: false, result: { thrown: true } });
  assert.equal(publishTransport.message, "Não foi possível publicar o artigo. Tente novamente.");

  const draft = blogPersistFeedback({ intent: "save", status: "DRAFT", isNew: false, result: { ok: true, post: { id: "post-1" } } });
  assert.equal(draft.message, "Rascunho salvo.");
  assert.equal(draft.href, null);
  const publishedSave = blogPersistFeedback({ intent: "save", status: "PUBLISHED", isNew: false, result: { ok: true, post: { id: "post-1" } } });
  assert.equal(publishedSave.message, "Alterações salvas.");
  const published = blogPersistFeedback({ intent: "publish", status: "DRAFT", isNew: false, result: { ok: true, post: { id: "post-1" } } });
  assert.equal(published.message, "Artigo publicado.");

  const created = blogPersistFeedback({ intent: "publish", status: null, isNew: true, result: { ok: true, post: { id: "post-2" } } });
  assert.equal(created.href, "/admin/blog/post-2?notice=published");
  assert.equal(blogNoticeFromQuery("published"), "published");
  assert.equal(blogNoticeFromQuery("saved"), "saved");
  assert.equal(blogNoticeFromQuery("Artigo publicado."), null);
  assert.equal(blogNoticeFromQuery("<script>alert(1)</script>"), null);
  assert.equal(blogNoticeFeedback("published", "PUBLISHED").message, "Artigo publicado.");
  assert.equal(blogNoticeFeedback("saved", "DRAFT").message, "Rascunho salvo.");
  assert.equal(blogNoticeFeedback("saved", "PUBLISHED").message, "Alterações salvas.");
  assert.equal(blogSaveLabel("PUBLISHED", null), "Salvar alterações");
  assert.equal(blogSaveLabel("DRAFT", null), "Salvar rascunho");
  assert.equal(blogSaveLabel(null, null), "Salvar rascunho");
});

test("o editor guarda a capa no estado, avisa perto das ações e não publica texto livre da URL", () => {
  const editor = readFileSync("src/components/admin/blog/BlogEditor.tsx", "utf8");
  const page = readFileSync("src/app/(admin)/admin/blog/[id]/page.tsx", "utf8");
  assert.equal(editor.includes("getElementById"), false);
  assert.match(editor, /selectedCover/);
  assert.match(editor, /URL\.createObjectURL/);
  assert.match(editor, /URL\.revokeObjectURL/);
  assert.match(editor, /Nova capa selecionada/);
  assert.match(editor, /Capa atual/);
  assert.match(editor, /formData\(selectedCover\)/);
  assert.match(editor, /runGuardedBlogAction/);
  assert.match(editor, /aria-busy=\{busy\}/);
  assert.match(editor, /pendingAction !== null/);
  assert.match(editor, /role="alert"/);
  assert.match(editor, /aria-live="polite"/);
  assert.match(editor, /blogSaveLabel\(initial\.status, pendingAction\)/);
  assert.match(editor, /blogPublishLabel\(pendingAction\)/);
  assert.equal(editor.includes("Imagem enviada"), false);
  assert.equal(editor.includes("Upload concluído"), false);
  assert.match(page, /blogNoticeFromQuery\(query\.notice\)/);
  assert.equal(page.includes("{query.notice}"), false);
  assert.equal(page.includes("{notice}"), false);
  assert.equal(readFileSync("src/lib/storage/apimg.ts", "utf8").includes("X-API-Key"), true);
});
