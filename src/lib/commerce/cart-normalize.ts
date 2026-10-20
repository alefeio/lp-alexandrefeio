import type { CartLine, ProductTypeName, SaleCourse, SaleLesson, SaleModule } from "@/lib/commerce/quote";

export type NormalizeCatalog = {
  lessons: Pick<SaleLesson, "id" | "moduleId" | "courseId">[];
  modules: Pick<SaleModule, "id" | "paidLessonIds" | "courseId">[];
  courses: Pick<SaleCourse, "id" | "paidLessonIds">[];
};

/** Capa mínima para normalizar no cliente ao adicionar um produto. */
export type CartProductCover = {
  type: ProductTypeName;
  id: string;
  /** Aulas pagas cobertas por este produto. */
  lessonIds: string[];
};

function dedupe(lines: CartLine[]): CartLine[] {
  const seen = new Set<string>();
  const result: CartLine[] = [];
  for (const line of lines) {
    const key = `${line.type}:${line.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(line);
  }
  return result;
}

/**
 * Remove redundância lógica do carrinho.
 * COURSE domina módulos e aulas contidos.
 * MODULE domina suas aulas e substitui outro módulo.
 * Lessons independentes podem coexistir com um módulo que não as contém.
 */
export function normalizeCartSelection(lines: CartLine[], catalog: NormalizeCatalog): CartLine[] {
  const deduped = dedupe(lines);
  if (deduped.length === 0) return [];

  const courses = deduped.filter((line) => line.type === "COURSE");
  if (courses.length > 0) {
    return [courses[courses.length - 1]!];
  }

  const modules = deduped.filter((line) => line.type === "MODULE");
  const lessons = deduped.filter((line) => line.type === "LESSON");

  if (modules.length > 0) {
    const chosen = modules[modules.length - 1]!;
    const moduleRow = catalog.modules.find((item) => item.id === chosen.id);
    const covered = new Set(moduleRow?.paidLessonIds ?? []);
    const keptLessons = lessons.filter((line) => !covered.has(line.id));
    return [...keptLessons, chosen];
  }

  return lessons;
}

/**
 * Normalização otimista no browser.
 * `currentCovers` descreve módulos já presentes (para não reintroduzir aula coberta).
 */
export function mergeCartLine(
  current: CartLine[],
  next: CartProductCover,
  currentCovers: CartProductCover[] = [],
): CartLine[] {
  if (next.type === "COURSE") return [{ type: "COURSE", id: next.id }];

  if (next.type === "MODULE") {
    const covered = new Set(next.lessonIds);
    const kept = current.filter((item) => {
      if (item.type === "COURSE" || item.type === "MODULE") return false;
      return !covered.has(item.id);
    });
    return [...kept, { type: "MODULE", id: next.id }];
  }

  if (current.some((item) => item.type === "COURSE")) {
    return current.filter((item) => item.type === "COURSE").slice(-1);
  }

  for (const item of current) {
    if (item.type !== "MODULE") continue;
    const cover = currentCovers.find((row) => row.type === "MODULE" && row.id === item.id);
    if (cover?.lessonIds.includes(next.id)) return dedupe(current);
  }

  return dedupe([...current.filter((item) => !(item.type === "LESSON" && item.id === next.id)), { type: "LESSON", id: next.id }]);
}
