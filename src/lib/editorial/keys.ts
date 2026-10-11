export function slugify(value: string): string {
  const slug = value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
  return slug || "item";
}

export function suggestBlockKey(source: string, taken: Iterable<string>): string {
  const used = new Set(taken);
  const base = slugify(source).slice(0, 60) || "bloco";
  let key = base;
  let n = 2;
  while (used.has(key)) {
    key = `${base}-${n}`.slice(0, 80);
    n += 1;
  }
  return key;
}
