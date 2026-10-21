const HEX = /^#[0-9a-f]{6}$/;

export function normalizeHex(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const raw = value.trim();
  if (/^(rgb|hsl|hwb|lab|lch|oklab|oklch|color|var|url|calc|color-mix)\s*\(/i.test(raw)) return null;
  if (/^#[0-9a-fA-F]{3}$/.test(raw)) {
    const [red, green, blue] = raw.slice(1).split("");
    return `#${red}${red}${green}${green}${blue}${blue}`.toLowerCase();
  }
  if (/^#[0-9a-fA-F]{6}$/.test(raw)) return raw.toLowerCase();
  return null;
}

export function isNormalizedHex(value: string): boolean {
  return HEX.test(value);
}

function channel(value: number): number {
  const scaled = value / 255;
  return scaled <= 0.03928 ? scaled / 12.92 : ((scaled + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance(hex: string): number {
  const normalized = normalizeHex(hex);
  if (!normalized) return 0;
  const red = Number.parseInt(normalized.slice(1, 3), 16);
  const green = Number.parseInt(normalized.slice(3, 5), 16);
  const blue = Number.parseInt(normalized.slice(5, 7), 16);
  return 0.2126 * channel(red) + 0.7152 * channel(green) + 0.0722 * channel(blue);
}

/** Razão WCAG de luminância relativa. O resultado é arredondado em duas casas. */
export function calculateContrastRatio(foreground: string, background: string): number {
  const first = relativeLuminance(foreground);
  const second = relativeLuminance(background);
  const lighter = Math.max(first, second);
  const darker = Math.min(first, second);
  return Math.round(((lighter + 0.05) / (darker + 0.05)) * 100) / 100;
}

export function mixHex(base: string, target: string, amount: number): string {
  const from = normalizeHex(base);
  const to = normalizeHex(target);
  if (!from || !to) return from ?? "#000000";
  const weight = Math.min(1, Math.max(0, amount));
  const mix = (start: number, end: number) => Math.round(start + (end - start) * weight);
  const red = mix(Number.parseInt(from.slice(1, 3), 16), Number.parseInt(to.slice(1, 3), 16));
  const green = mix(Number.parseInt(from.slice(3, 5), 16), Number.parseInt(to.slice(3, 5), 16));
  const blue = mix(Number.parseInt(from.slice(5, 7), 16), Number.parseInt(to.slice(5, 7), 16));
  return `#${[red, green, blue].map((part) => part.toString(16).padStart(2, "0")).join("")}`;
}
