/**
 * Ponto único de analytics.
 * Em desenvolvimento, registra no console.
 * Em produção, é no-op até uma ferramenta ser conectada aqui.
 */
export type AnalyticsEventName =
  | "cta_click"
  | "whatsapp_click"
  | "service_interest"
  | "form_start"
  | "form_submit"
  | "form_success";

export type AnalyticsParams = Record<string, string | number | boolean | null | undefined>;

export function trackEvent(event: AnalyticsEventName, params: AnalyticsParams = {}): void {
  if (process.env.NODE_ENV !== "development") {
    return;
  }

  console.info("[analytics]", event, params);
}
