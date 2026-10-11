import Link from "next/link";
import { notFound } from "next/navigation";
import { EditorialForm } from "@/components/editorial/EditorialForm";
import { AssetOptions, fieldClass, Field } from "@/components/editorial/fields";
import { Container } from "@/components/ui/Container";
import { requireAdmin } from "@/lib/auth/session";
import { getPrisma } from "@/lib/db/prisma";
import { createLessonAction, openBundleSaleAction, saveModuleAction } from "@/lib/editorial/actions";
import { bundleSaleReady } from "@/lib/editorial/readiness";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ id: string }> };

export default async function AdminModulePage({ params }: PageProps) {
  const session = await requireAdmin();
  if (!session) return null;
  const { id } = await params;
  const prisma = getPrisma();
  const moduleRow = await prisma.module.findUnique({
    where: { id },
    include: { course: true, lessons: { orderBy: { sortOrder: "asc" } } },
  });
  if (!moduleRow) notFound();
  const assets = await prisma.mediaAsset.findMany({ orderBy: { createdAt: "desc" }, take: 30 });
  const sale = bundleSaleReady("módulo", moduleRow.lessons);

  return (
    <Container className="max-w-3xl">
      <p className="text-xs font-medium uppercase tracking-[0.16em] text-cta">Módulo</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight">{moduleRow.title}</h1>
      <p className="mt-3 text-sm">
        <Link className="underline underline-offset-4" href={`/admin/cursos/${moduleRow.courseId}`}>{moduleRow.course.title}</Link>
      </p>
      <ul className="mt-4 list-disc space-y-1 pl-5 text-sm">
        {sale.ready ? <li>O pacote do módulo passaria na checagem de venda.</li> : sale.issues.map((issue) => <li key={issue}>{issue}</li>)}
      </ul>
      <EditorialForm action={openBundleSaleAction.bind(null, "module", moduleRow.id)} submit="Disponibilizar pacote do módulo" />
      <EditorialForm action={saveModuleAction.bind(null, moduleRow.id)} submit="Salvar módulo">
        <input type="hidden" name="updatedAt" value={moduleRow.updatedAt.toISOString()} />
        <Field label="Título"><input className={fieldClass} name="title" defaultValue={moduleRow.title} required /></Field>
        <Field label="Descrição"><textarea className={`${fieldClass} min-h-28 py-3`} name="description" defaultValue={moduleRow.description} required /></Field>
        <Field label="Ordem"><input className={fieldClass} name="sortOrder" type="number" defaultValue={moduleRow.sortOrder} /></Field>
        <Field label="Preço do pacote em centavos"><input className={fieldClass} name="bundlePriceCents" defaultValue={moduleRow.bundlePriceCents ?? ""} /></Field>
        <Field label="Status">
          <select className={fieldClass} name="status" defaultValue={moduleRow.status}>
            <option value="DRAFT">Rascunho</option>
            <option value="PUBLISHED">Publicado</option>
          </select>
        </Field>
        <Field label="Imagem editorial"><AssetOptions assets={assets} currentPublicId={moduleRow.coverImagePublicId} /></Field>
        <fieldset className="space-y-3">
          <legend className="text-sm font-medium">Ordem das aulas</legend>
          {moduleRow.lessons.map((lesson) => (
            <label key={lesson.id} className="flex items-center justify-between gap-3 text-sm">
              <Link className="underline underline-offset-4" href={`/admin/aulas/${lesson.id}`}>{lesson.title}</Link>
              <input className="h-12 w-24 rounded-lg border border-border px-3" name={`lessonOrder:${lesson.id}`} type="number" defaultValue={lesson.sortOrder} />
            </label>
          ))}
        </fieldset>
      </EditorialForm>
      <h2 className="mt-12 text-xl font-semibold">Nova aula</h2>
      <EditorialForm action={createLessonAction.bind(null, moduleRow.id)} submit="Criar aula">
        <Field label="Título"><input className={fieldClass} name="title" required /></Field>
        <Field label="Resumo"><textarea className={`${fieldClass} min-h-24 py-3`} name="summary" required /></Field>
        <Field label="Acesso">
          <select className={fieldClass} name="accessType" defaultValue="PAID">
            <option value="FREE">Gratuita</option>
            <option value="PAID">Paga</option>
          </select>
        </Field>
      </EditorialForm>
    </Container>
  );
}
