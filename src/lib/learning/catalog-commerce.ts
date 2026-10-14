export type CatalogCommerceOptions = {
  /** catalog:deploy preserva. db:seed continua fechando a venda. */
  preserveCommerceStatus?: boolean;
};

export function preserveCommerce(options?: CatalogCommerceOptions): boolean {
  return options?.preserveCommerceStatus === true;
}

/** Registro novo nasce fora de venda. */
export function commerceStatusForCreate(): "NOT_FOR_SALE" {
  return "NOT_FOR_SALE";
}

/**
 * Update do catálogo. Objeto vazio não inclui commerceStatus, então o valor existente fica.
 * Sem preservação, o seed de development regrava NOT_FOR_SALE.
 */
export function commercePatch(preserveCommerceStatus: boolean): { commerceStatus: "NOT_FOR_SALE" } | Record<string, never> {
  if (preserveCommerceStatus) return {};
  return { commerceStatus: "NOT_FOR_SALE" };
}

export function commerceStatusMatches(actual: string, preserveCommerceStatus: boolean): boolean {
  if (preserveCommerceStatus) return actual === "NOT_FOR_SALE" || actual === "AVAILABLE";
  return actual === "NOT_FOR_SALE";
}
