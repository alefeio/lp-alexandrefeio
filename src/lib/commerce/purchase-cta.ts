const SLUG = /^[a-z0-9-]{1,80}$/;

/** Pedido de uma única aula aponta para ela. Módulo, curso ou vários itens não inventam esse destino. */
export function purchasedLessonPath(items: { productType: string; lessonSlug: string | null }[]): string | null {
  if (items.length !== 1) return null;
  const item = items[0];
  if (!item || item.productType !== "LESSON" || !item.lessonSlug || !SLUG.test(item.lessonSlug)) return null;
  return `/aulas/${item.lessonSlug}`;
}
