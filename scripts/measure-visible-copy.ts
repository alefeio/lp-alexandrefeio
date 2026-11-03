import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CourseHome } from "../src/components/home/CourseHome";
import { CourseSales } from "../src/components/course/CourseSales";
import type { SalesCourse } from "../src/components/course/sales-types";
import { firstCourseSeed } from "../src/lib/learning/first-course";
import { sitesCourseSeed } from "../src/lib/learning/sites-course";

/** Baseline at 35e2c93 with the same stripper (no header/footer, closed details/hidden removed). */
const BEFORE = {
  home: 921,
  traffic: 844,
  sites: 822,
} as const;

function pageCourse(seed: typeof firstCourseSeed | typeof sitesCourseSeed): SalesCourse {
  return {
    id: seed.slug,
    slug: seed.slug,
    title: seed.title,
    subtitle: seed.subtitle,
    description: seed.description,
    bundlePriceCents: seed.bundlePriceCents,
    commerceStatus: "NOT_FOR_SALE",
    modules: seed.modules.map((moduleRow) => ({
      id: moduleRow.slug,
      title: moduleRow.title,
      description: moduleRow.description,
      bundlePriceCents: moduleRow.bundlePriceCents,
      commerceStatus: "NOT_FOR_SALE",
      lessons: moduleRow.lessons.map((lesson) => ({
        id: lesson.slug,
        slug: lesson.slug,
        title: lesson.title,
        summary: lesson.summary,
        estimatedMinutes: lesson.estimatedMinutes,
        accessType: lesson.accessType,
        commerceStatus: "NOT_FOR_SALE",
        priceCents: lesson.priceCents,
        hasPublicPreview: lesson.accessType === "PAID",
        hasBody: true,
      })),
    })),
  };
}

function removeBalanced(html: string, openIndex: number): { html: string; next: number } {
  const slice = html.slice(openIndex);
  const openTag = slice.match(/^<([a-z0-9-]+)\b[^>]*>/i);
  if (!openTag) return { html, next: openIndex + 1 };
  const tag = openTag[1]!;
  if (/\/>$/.test(openTag[0])) {
    const end = openIndex + openTag[0].length;
    return { html: html.slice(0, openIndex) + html.slice(end), next: openIndex };
  }
  let depth = 1;
  let cursor = openIndex + openTag[0].length;
  const openRe = new RegExp(`<${tag}\\b[^>]*>`, "ig");
  const closeRe = new RegExp(`</${tag}\\s*>`, "ig");
  while (cursor < html.length && depth > 0) {
    openRe.lastIndex = cursor;
    closeRe.lastIndex = cursor;
    const nextOpen = openRe.exec(html);
    const nextClose = closeRe.exec(html);
    if (!nextClose) break;
    if (nextOpen && nextOpen.index < nextClose.index) {
      depth += 1;
      cursor = nextOpen.index + nextOpen[0].length;
      continue;
    }
    depth -= 1;
    cursor = nextClose.index + nextClose[0].length;
  }
  return { html: html.slice(0, openIndex) + html.slice(cursor), next: openIndex };
}

function stripClosed(html: string): string {
  let next = html.replace(/<details\b[^>]*>[\s\S]*?<\/details>/gi, (block) => {
    const summary = block.match(/<summary\b[^>]*>[\s\S]*?<\/summary>/i)?.[0] ?? "";
    return summary;
  });
  next = next.replace(/<figcaption class="sr-only">[\s\S]*?<\/figcaption>/gi, "");
  let index = 0;
  while (index < next.length) {
    const match = next.slice(index).match(/<[a-z0-9-]+\b[^>]*\bhidden(?:="[^"]*")?[^>]*>/i);
    if (!match || match.index == null) break;
    const at = index + match.index;
    const removed = removeBalanced(next, at);
    next = removed.html;
    index = removed.next;
  }
  return next
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function countWords(html: string): number {
  return stripClosed(html).split(/\s+/).filter(Boolean).length;
}

function catalogCard(seed: typeof firstCourseSeed | typeof sitesCourseSeed) {
  const free = seed.modules.flatMap((moduleRow) => moduleRow.lessons).filter((lesson) => lesson.accessType === "FREE" && lesson.slug);
  return {
    id: seed.slug,
    slug: seed.slug,
    title: seed.title,
    summary: seed.description,
    lessonCount: seed.modules.reduce((sum, moduleRow) => sum + moduleRow.lessons.length, 0),
    moduleCount: seed.modules.length,
    freeLessonCount: free.length,
    freeLessons: free.slice(0, 3).map((lesson, index) => ({ slug: lesson.slug, title: lesson.title, number: index + 1 })),
    href: `/cursos/${seed.slug}`,
    ctaLabel: "Conhecer o curso" as const,
    microcopy: null,
    progress: null,
  };
}

const home = renderToStaticMarkup(
  createElement(CourseHome, {
    courses: [catalogCard(firstCourseSeed), catalogCard(sitesCourseSeed)],
  }),
);
const traffic = renderToStaticMarkup(createElement(CourseSales, { course: pageCourse(firstCourseSeed) }));
const sites = renderToStaticMarkup(createElement(CourseSales, { course: pageCourse(sitesCourseSeed) }));

const after = {
  home: countWords(home),
  traffic: countWords(traffic),
  sites: countWords(sites),
};

function reduction(before: number, current: number) {
  return `${Math.round(((before - current) / before) * 100)}%`;
}

console.log(
  JSON.stringify(
    {
      HOME_VISIBLE_WORDS_BEFORE: BEFORE.home,
      HOME_VISIBLE_WORDS_AFTER: after.home,
      HOME_REDUCTION: reduction(BEFORE.home, after.home),
      TRAFFIC_VISIBLE_WORDS_BEFORE: BEFORE.traffic,
      TRAFFIC_VISIBLE_WORDS_AFTER: after.traffic,
      TRAFFIC_REDUCTION: reduction(BEFORE.traffic, after.traffic),
      SITES_VISIBLE_WORDS_BEFORE: BEFORE.sites,
      SITES_VISIBLE_WORDS_AFTER: after.sites,
      SITES_REDUCTION: reduction(BEFORE.sites, after.sites),
    },
    null,
    2,
  ),
);
