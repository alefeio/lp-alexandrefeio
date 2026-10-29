const SLUG = /^[a-z0-9-]{1,80}$/;

/** Pedido de uma única aula aponta para ela. Módulo, curso ou vários itens não inventam esse destino. */
export function purchasedLessonPath(items: { productType: string; lessonSlug: string | null }[]): string | null {
  if (items.length !== 1) return null;
  const item = items[0];
  if (!item || item.productType !== "LESSON" || !item.lessonSlug || !SLUG.test(item.lessonSlug)) return null;
  return `/aulas/${item.lessonSlug}`;
}

/** Depois do pagamento: aula única abre a aula; módulo ou curso vão para a área do aluno. */
export function paidOrderStart(items: { productType: string; lessonSlug: string | null }[]): { href: string; cta: string } {
  const lesson = purchasedLessonPath(items);
  if (lesson) return { href: lesson, cta: "Começar aula" };
  return { href: "/app", cta: "Ver meus cursos" };
}
