export type CatalogCommerceOptions = {
  /** false só é um fechamento explícito. O padrão preserva, porque o banco é compartilhado. */
  preserveCommerceStatus?: boolean;
};

export function preserveCommerce(options?: CatalogCommerceOptions): boolean {
  return options?.preserveCommerceStatus !== false;
}

/** Registro novo nasce fora de venda. */
export function commerceStatusForCreate(): "NOT_FOR_SALE" {
  return "NOT_FOR_SALE";
}

/**
 * Update do catálogo. Objeto vazio não inclui commerceStatus, então o valor existente fica.
 * O fechamento explícito existe só para um opt-in. Nenhum script de catálogo ou seed o usa.
 */
export function commercePatch(preserveCommerceStatus: boolean): { commerceStatus: "NOT_FOR_SALE" } | Record<string, never> {
  if (preserveCommerceStatus) return {};
  return { commerceStatus: "NOT_FOR_SALE" };
}

export function commerceStatusMatches(actual: string, preserveCommerceStatus: boolean): boolean {
  if (preserveCommerceStatus) return actual === "NOT_FOR_SALE" || actual === "AVAILABLE";
  return actual === "NOT_FOR_SALE";
}
