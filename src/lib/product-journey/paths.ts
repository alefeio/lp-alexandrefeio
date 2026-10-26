export function journeyPath(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//") || trimmed.includes("\\") || trimmed.includes(":")) return undefined;
  const path = trimmed.split("?")[0]?.split("#")[0] ?? "";
  if (!path.startsWith("/") || path.length > 300) return undefined;
  return path;
}
