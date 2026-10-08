const SERVICE_ANALYTICS_NAMES: Record<string, string> = {
  "site-essencial": "site_essencial",
  "site-trafego": "site_trafego",
  "gestao-trafego": "gestao_trafego",
  "trafego-pago": "trafego_pago",
};

export function toServiceAnalyticsName(serviceId: string | undefined): string | undefined {
  if (!serviceId) return undefined;
  return SERVICE_ANALYTICS_NAMES[serviceId];
}

export function objectiveToServiceName(objective: string | undefined): string | undefined {
  if (!objective) return undefined;
  if (objective === "criar-site" || objective === "melhorar-site") return "site_essencial";
  if (objective === "site-trafego") return "site_trafego";
  if (objective === "google-ads" || objective === "meta-ads") return "gestao_trafego";
  return undefined;
}
