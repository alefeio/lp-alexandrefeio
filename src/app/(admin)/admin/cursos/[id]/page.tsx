import Link from "next/link";
import { notFound } from "next/navigation";
import { EditorialForm } from "@/components/editorial/EditorialForm";
import { AssetOptions, fieldClass, Field } from "@/components/editorial/fields";
import { Container } from "@/components/ui/Container";
import { requireAdmin } from "@/lib/auth/session";
import { getPrisma } from "@/lib/db/prisma";
import { createModuleAction, openBundleSaleAction, saveCourseAction } from "@/lib/editorial/actions";
import { assessLesson, bundleSaleReady } from "@/lib/editorial/readiness";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ id: string }> };

export default async function AdminCoursePage({ params }: PageProps) {
  const session = await requireAdmin();
  if (!session) return null;
  const { id } = await params;
  const prisma = getPrisma();
  const course = await prisma.course.findUnique({
    where: { id },
    include: { modules: { orderBy: { sortOrder: "asc" }, include: { lessons: { orderBy: { sortOrder: "asc" }, include: { blocks: true } } } } },
  });
  if (!course) notFound();
  const assets = await prisma.mediaAsset.findMany({ orderBy: { createdAt: "desc" }, take: 30 });
  const lessons = course.modules.flatMap((moduleRow) => moduleRow.lessons);
  const sale = bundleSaleReady("curso", lessons);
  const pending = lessons.flatMap((lesson) => {
    const assessment = assessLesson(lesson, lesson.blocks);
    return assessment.ready ? [] : [`${lesson.title}: ${assessment.issues[0]}`];
  });

  return (
    <Container className="max-w-3xl">
      <p className="text-xs font-medium uppercase tracking-[0.16em] text-cta">Curso</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight">{course.title}</h1>
      <p className="mt-3 text-sm text-muted">Curso publicado não é excluído por aqui. Venda do pacote só depois que cada aula paga estiver disponível.</p>
      <h2 className="mt-8 text-xl font-semibold">Prontidão</h2>
      <ul className="mt-3 list-disc space-y-1 pl-5 text-sm">
        {sale.ready ? <li>O pacote do curso passaria na checagem de venda.</li> : sale.issues.map((issue) => <li key={issue}>{issue}</li>)}
        {pending.slice(0, 8).map((issue) => <li key={issue}>{issue}</li>)}
      </ul>
      <EditorialForm action={openBundleSaleAction.bind(null, "course", course.id)} submit="Disponibilizar pacote do curso" />
      <EditorialForm action={saveCourseAction.bind(null, course.id)} submit="Salvar curso">
        <input type="hidden" name="updatedAt" value={course.updatedAt.toISOString()} />
        <Field label="Título"><input className={fieldClass} name="title" defaultValue={course.title} required /></Field>
        <Field label="Subtítulo"><input className={fieldClass} name="subtitle" defaultValue={course.subtitle ?? ""} /></Field>
        <Field label="Descrição"><textarea className={`${fieldClass} min-h-28 py-3`} name="description" defaultValue={course.description} required /></Field>
        <Field label="Ordem"><input className={fieldClass} name="sortOrder" type="number" defaultValue={course.sortOrder} /></Field>
        <Field label="Preço do pacote em centavos"><input className={fieldClass} name="bundlePriceCents" defaultValue={course.bundlePriceCents ?? ""} /></Field>
        <Field label="Status">
          <select className={fieldClass} name="status" defaultValue={course.status}>
            <option value="DRAFT">Rascunho</option>
            <option value="PUBLISHED">Publicado</option>
          </select>
        </Field>
        <Field label="Imagem editorial"><AssetOptions assets={assets} currentPublicId={course.coverImagePublicId} /></Field>
      </EditorialForm>
      <h2 className="mt-12 text-xl font-semibold">Módulos</h2>
      <ul className="mt-4 space-y-3">
        {course.modules.map((moduleRow) => (
          <li key={moduleRow.id}>
            <Link className="underline underline-offset-4" href={`/admin/modulos/${moduleRow.id}`}>{moduleRow.title}</Link>
            <span className="ml-2 text-sm text-muted">{moduleRow.status === "PUBLISHED" ? "Publicado" : "Rascunho"}</span>
          </li>
        ))}
      </ul>
      <h2 className="mt-10 text-xl font-semibold">Novo módulo</h2>
      <EditorialForm action={createModuleAction.bind(null, course.id)} submit="Criar módulo">
        <Field label="Título"><input className={fieldClass} name="title" required /></Field>
        <Field label="Descrição"><textarea className={`${fieldClass} min-h-24 py-3`} name="description" required /></Field>
      </EditorialForm>
    </Container>
  );
}
