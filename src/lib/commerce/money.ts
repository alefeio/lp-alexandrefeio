/** Limite administrativo de preço unitário (R$ 99.999,99). */
export const MAX_PRICE_CENTS = 9_999_999;

/**
 * Converte texto em reais (pt-BR) para centavos inteiros.
 * Aceita: `14,90`, `R$ 14,90`, `1.234,56`, `15`, `1.234`.
 * Rejeita formatos ambíguos/inválidos; sem arredondamento por float.
 */
export function parseBrlToCents(raw: string): { ok: true; cents: number } | { ok: false; message: string } {
  const trimmed = raw.trim();
  if (!trimmed) return { ok: false, message: "Informe um valor em reais." };

  const text = trimmed.replace(/\s+/g, " ").replace(/^R\$\s?/i, "").trim();
  if (!text) return { ok: false, message: "Informe um valor em reais." };
  if (text.includes("-") || text.startsWith("+")) {
    return { ok: false, message: "O preço não pode ser negativo." };
  }
  if (/[^\d.,]/.test(text)) return { ok: false, message: "Formato monetário inválido." };
  if (text.includes("..") || text.includes(",,") || text.includes(".,") || text.includes(",.")) {
    return { ok: false, message: "Formato monetário inválido." };
  }

  // Ambíguo: decimal com ponto e sem vírgula (ex.: 14.90).
  if (/^\d+\.\d{1,2}$/.test(text)) {
    return { ok: false, message: "Use o formato brasileiro com vírgula (ex.: 14,90)." };
  }

  if (text.includes(",")) {
    const parts = text.split(",");
    if (parts.length !== 2) return { ok: false, message: "Formato monetário inválido." };
    const wholeDigits = parseWholeBrl(parts[0]!);
    if (wholeDigits == null) return { ok: false, message: "Formato monetário inválido." };
    const fraction = parts[1]!;
    if (!/^\d{1,2}$/.test(fraction)) return { ok: false, message: "Formato monetário inválido." };
    const cents = wholeDigits * 100 + Number(fraction.padEnd(2, "0"));
    return validateCents(cents);
  }

  const wholeDigits = parseWholeBrl(text);
  if (wholeDigits == null) return { ok: false, message: "Formato monetário inválido." };
  return validateCents(wholeDigits * 100);
}

/** Parte inteira: só dígitos (`15`, `1234`) ou milhares pt-BR (`1.234`, `1.234.567`). */
function parseWholeBrl(whole: string): number | null {
  if (!whole) return null;
  if (/^\d+$/.test(whole)) {
    const value = Number(whole);
    return Number.isSafeInteger(value) ? value : null;
  }
  if (!/^\d{1,3}(\.\d{3})+$/.test(whole)) return null;
  const digits = whole.replace(/\./g, "");
  if (!/^\d+$/.test(digits)) return null;
  const value = Number(digits);
  return Number.isSafeInteger(value) ? value : null;
}

function validateCents(cents: number): { ok: true; cents: number } | { ok: false; message: string } {
  if (!Number.isFinite(cents) || Number.isNaN(cents)) {
    return { ok: false, message: "Valor monetário inválido." };
  }
  if (!Number.isSafeInteger(cents) || cents < 0) {
    return { ok: false, message: "Valor monetário inválido." };
  }
  if (cents > MAX_PRICE_CENTS) {
    return { ok: false, message: "O preço ultrapassa o limite permitido." };
  }
  return { ok: true, cents };
}

/** Formata centavos como `R$ 14,90`. */
export function formatCentsToBrl(cents: number | null | undefined): string {
  if (cents == null) return "—";
  if (!Number.isSafeInteger(cents) || cents < 0) return "—";
  const whole = Math.floor(cents / 100);
  const fraction = String(cents % 100).padStart(2, "0");
  const grouped = whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `R$ ${grouped},${fraction}`;
}

/** Percentual de desconto com aritmética inteira (centésimos de ponto percentual). */
export function percentOff(listCents: number, bundleCents: number): number | null {
  if (!Number.isSafeInteger(listCents) || !Number.isSafeInteger(bundleCents) || listCents <= 0) return null;
  if (bundleCents >= listCents) return 0;
  const basisPoints = Math.floor(((listCents - bundleCents) * 10000) / listCents);
  return basisPoints / 100;
}

export function savingsCents(listCents: number, bundleCents: number): number {
  if (!Number.isSafeInteger(listCents) || !Number.isSafeInteger(bundleCents)) return 0;
  return Math.max(0, listCents - bundleCents);
}
