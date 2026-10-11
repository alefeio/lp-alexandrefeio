import Link from "next/link";
import { notFound } from "next/navigation";
import { BlockComposer } from "@/components/editorial/BlockComposer";
import { EditorialForm } from "@/components/editorial/EditorialForm";
import { ExistingBlock } from "@/components/editorial/ExistingBlock";
import { AssetOptions, fieldClass, Field } from "@/components/editorial/fields";
import { Container } from "@/components/ui/Container";
import { requireAdmin } from "@/lib/auth/session";
import { getPrisma } from "@/lib/db/prisma";
import {
  applyImportAction,
  closeLessonSaleAction,
  createBlockAction,
  openLessonSaleAction,
  previewImportAction,
  removeBlockAction,
  reorderBlocksAction,
  saveLessonAction,
  updateBlockAction,
  uploadEditorialImageAction,
} from "@/lib/editorial/actions";
import { exportLessonDocument, lessonReadiness } from "@/lib/editorial/service";
import { apimgConfigured } from "@/lib/storage/apimg";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ id: string }> };

export default async function AdminLessonPage({ params }: PageProps) {
  const session = await requireAdmin();
  if (!session) return null;
  const { id } = await params;
  const prisma = getPrisma();
  const lesson = await prisma.lesson.findUnique({
    where: { id },
    include: { module: { include: { course: true } }, blocks: { orderBy: { position: "asc" } } },
  });
  if (!lesson) notFound();
  const assets = await prisma.mediaAsset.findMany({ orderBy: { createdAt: "desc" }, take: 30 });
  const readiness = await lessonReadiness(lesson.id);
  const active = lesson.blocks.filter((block) => !block.retiredAt);
  const document = exportLessonDocument(lesson.id, lesson.blocks);

  return (
    <Container className="max-w-3xl">
      <p className="text-xs font-medium uppercase tracking-[0.16em] text-cta">Aula</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight">{lesson.title}</h1>
      <p className="mt-3 text-sm text-muted">
        <Link className="underline underline-offset-4" href={`/admin/modulos/${lesson.moduleId}`}>{lesson.module.title}</Link>
        {" · "}
        {lesson.commerceStatus === "AVAILABLE" ? "Disponível para venda" : "Fora de venda"}
        {" · "}
        <Link className="underline underline-offset-4" href={`/admin/aulas/${lesson.id}/preview`}>Pré-visualizar</Link>
      </p>
      <h2 className="mt-8 text-xl font-semibold">Validar aula</h2>
      {readiness?.content.ready ? (
        <p className="mt-3 text-sm">Pronta para publicação. Publicar não coloca a aula à venda.</p>
      ) : (
        <div className="mt-3">
          <p className="text-sm font-medium">Pendências</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
            {readiness?.content.issues.map((issue) => <li key={issue}>{issue}</li>)}
          </ul>
        </div>
      )}
      <EditorialForm action={saveLessonAction.bind(null, lesson.id)} submit="Salvar aula">
        <input type="hidden" name="updatedAt" value={lesson.updatedAt.toISOString()} />
        <Field label="Título"><input className={fieldClass} name="title" defaultValue={lesson.title} required /></Field>
        <Field label="Resumo"><textarea className={`${fieldClass} min-h-24 py-3`} name="summary" defaultValue={lesson.summary} required /></Field>
        <Field label="Preview público"><textarea className={`${fieldClass} min-h-24 py-3`} name="publicPreview" defaultValue={lesson.publicPreview ?? ""} /></Field>
        <Field label="Minutos estimados"><input className={fieldClass} name="estimatedMinutes" type="number" min={0} defaultValue={lesson.estimatedMinutes ?? ""} /></Field>
        <Field label="Acesso">
          <select className={fieldClass} name="accessType" defaultValue={lesson.accessType}>
            <option value="FREE">Gratuita</option>
            <option value="PAID">Paga</option>
          </select>
        </Field>
        <Field label="Preço em centavos"><input className={fieldClass} name="priceCents" defaultValue={lesson.priceCents ?? ""} /></Field>
        <Field label="Ordem"><input className={fieldClass} name="sortOrder" type="number" defaultValue={lesson.sortOrder} /></Field>
        <Field label="Status">
          <select className={fieldClass} name="status" defaultValue={lesson.status}>
            <option value="DRAFT">Rascunho</option>
            <option value="PUBLISHED">Publicado</option>
          </select>
        </Field>
        <Field label="Publicada em (ISO, opcional)"><input className={fieldClass} name="publishedAt" defaultValue={lesson.publishedAt?.toISOString() ?? ""} /></Field>
        <Field label="Capa"><AssetOptions assets={assets} currentPublicId={lesson.coverImagePublicId} /></Field>
      </EditorialForm>
      <p className="mt-8 text-sm text-muted">Disponibilizar para venda é uma ação separada. Ficar pronta não liga o comércio.</p>
      <EditorialForm action={openLessonSaleAction.bind(null, lesson.id)} submit="Disponibilizar para venda" />
      <EditorialForm action={closeLessonSaleAction.bind(null, lesson.id)} submit="Retirar da venda" />

      <h2 className="mt-12 text-xl font-semibold">Blocos</h2>
      <EditorialForm action={reorderBlocksAction.bind(null, lesson.id)} submit="Salvar ordem">
        <input type="hidden" name="updatedAt" value={lesson.updatedAt.toISOString()} />
        <ul className="space-y-3">
          {active.map((block) => (
            <li key={block.id} className="flex items-center justify-between gap-3 text-sm">
              <span>{block.blockKey}</span>
              <input className="h-12 w-24 rounded-lg border border-border px-3" name={`position:${block.id}`} type="number" defaultValue={block.position} />
            </li>
          ))}
        </ul>
      </EditorialForm>
      <div className="mt-8 space-y-8">
        {active.map((block) => (
          <ExistingBlock
            key={`${block.id}-${block.updatedAt.toISOString()}`}
            block={block}
            updatedAt={lesson.updatedAt.toISOString()}
            published={lesson.status === "PUBLISHED"}
            save={updateBlockAction.bind(null, block.id)}
            remove={removeBlockAction.bind(null, block.id)}
          />
        ))}
      </div>
      <h2 className="mt-12 text-xl font-semibold">Novo bloco</h2>
      <BlockComposer action={createBlockAction.bind(null, lesson.id)} updatedAt={lesson.updatedAt.toISOString()} taken={lesson.blocks.map((block) => block.blockKey)} />

      <h2 className="mt-12 text-xl font-semibold">Imagem editorial</h2>
      {apimgConfigured() ? (
        <EditorialForm action={uploadEditorialImageAction} submit="Enviar imagem">
          <Field label="Arquivo JPEG, PNG ou WebP até 5 MB"><input className={fieldClass} name="file" type="file" accept="image/jpeg,image/png,image/webp" required /></Field>
          <Field label="Texto alternativo"><input className={fieldClass} name="alt" /></Field>
          <label className="flex items-center gap-2 text-sm"><input name="decorative" type="checkbox" /> Imagem decorativa</label>
        </EditorialForm>
      ) : (
        <p className="mt-3 text-sm text-muted">O envio de imagens não está configurado neste ambiente.</p>
      )}

      <h2 className="mt-12 text-xl font-semibold">JSON da aula</h2>
      <textarea className={`${fieldClass} min-h-40 py-3 font-mono text-xs`} readOnly defaultValue={JSON.stringify(document, null, 2)} />
      <EditorialForm action={previewImportAction.bind(null, lesson.id)} submit="Validar importação">
        <Field label="JSON"><textarea className={`${fieldClass} min-h-40 py-3 font-mono text-xs`} name="document" /></Field>
      </EditorialForm>
      <EditorialForm action={applyImportAction.bind(null, lesson.id)} submit="Aplicar importação">
        <input type="hidden" name="updatedAt" value={lesson.updatedAt.toISOString()} />
        <Field label="O mesmo JSON, depois da validação"><textarea className={`${fieldClass} min-h-40 py-3 font-mono text-xs`} name="document" /></Field>
      </EditorialForm>
    </Container>
  );
}
