/** Limite administrativo de preço unitário (R$ 99.999,99). */
export const MAX_PRICE_CENTS = 9_999_999;

/**
 * Converte texto em reais (pt-BR) para centavos inteiros.
 * Aceita: `14,90`, `R$ 14,90`, `1.234,56`.
 * Rejeita negativo, ambíguo (ponto decimal sem vírgula), NaN e fora do limite.
 */
export function parseBrlToCents(raw: string): { ok: true; cents: number } | { ok: false; message: string } {
  const trimmed = raw.trim();
  if (!trimmed) return { ok: false, message: "Informe um valor em reais." };

  const text = trimmed.replace(/\s+/g, " ").replace(/^R\$\s?/i, "").trim();
  if (!text) return { ok: false, message: "Informe um valor em reais." };
  if (text.includes("-")) return { ok: false, message: "O preço não pode ser negativo." };

  // Ambíguo: decimal com ponto e sem vírgula (ex.: 14.90).
  if (/^\d+\.\d{1,2}$/.test(text)) {
    return { ok: false, message: "Use o formato brasileiro com vírgula (ex.: 14,90)." };
  }

  // pt-BR: milhar com ponto, decimal com vírgula.
  if (text.includes(",")) {
    const parts = text.split(",");
    if (parts.length !== 2) return { ok: false, message: "Formato monetário inválido." };
    const whole = parts[0]!.replace(/\./g, "");
    const fraction = parts[1]!;
    if (!/^\d+$/.test(whole) || !/^\d{1,2}$/.test(fraction)) {
      return { ok: false, message: "Formato monetário inválido." };
    }
    const cents = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
    return validateCents(cents);
  }

  // Apenas reais inteiros: "15" ou "1.234"
  const whole = text.replace(/\./g, "");
  if (!/^\d+$/.test(whole)) return { ok: false, message: "Formato monetário inválido." };
  const cents = Number(whole) * 100;
  return validateCents(cents);
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
  const negative = cents < 0;
  const abs = Math.abs(cents);
  const whole = Math.floor(abs / 100);
  const fraction = String(abs % 100).padStart(2, "0");
  const grouped = whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${negative ? "-" : ""}R$ ${grouped},${fraction}`;
}

export function percentOff(listCents: number, bundleCents: number): number | null {
  if (!Number.isSafeInteger(listCents) || !Number.isSafeInteger(bundleCents) || listCents <= 0) return null;
  if (bundleCents >= listCents) return 0;
  return Math.round(((listCents - bundleCents) * 10000) / listCents) / 100;
}

export function savingsCents(listCents: number, bundleCents: number): number {
  if (!Number.isSafeInteger(listCents) || !Number.isSafeInteger(bundleCents)) return 0;
  return Math.max(0, listCents - bundleCents);
}
