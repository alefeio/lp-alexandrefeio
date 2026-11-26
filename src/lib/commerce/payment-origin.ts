/** Origem prospectiva de tentativa de cobrança — sem tokens de sessão. */

export function classifyDeviceCategory(
  userAgent: string | null | undefined,
): "desktop" | "mobile" | "tablet" | "unknown" {
  if (!userAgent) return "unknown";
  const ua = userAgent.toLowerCase();
  if (ua.includes("ipad") || (ua.includes("android") && !ua.includes("mobile") && ua.includes("tablet"))) {
    return "tablet";
  }
  if (ua.includes("mobi") || ua.includes("iphone") || ua.includes("android")) return "mobile";
  if (
    ua.includes("mozilla") ||
    ua.includes("chrome") ||
    ua.includes("safari") ||
    ua.includes("firefox") ||
    ua.includes("edg")
  ) {
    return "desktop";
  }
  return "unknown";
}
