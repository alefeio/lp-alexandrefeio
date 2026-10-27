/** Fontes da inteligência editorial. Search Console e termos de anúncio ficam previstos, sem cliente nesta sprint. */
export const EDITORIAL_SIGNAL_SOURCES = ["inventory", "web_search"] as const;
export const FUTURE_EDITORIAL_SIGNAL_SOURCES = ["search_console", "ads_search_terms"] as const;

export type EditorialSignalSource = (typeof EDITORIAL_SIGNAL_SOURCES)[number] | (typeof FUTURE_EDITORIAL_SIGNAL_SOURCES)[number];

export function activeEditorialSignals(): readonly string[] {
  return EDITORIAL_SIGNAL_SOURCES;
}
