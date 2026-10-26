import { Prisma } from "@/generated/prisma/client";
import { receivedRevenueCents } from "@/lib/admin/operations";
import {
  JOURNEY_FUNNEL,
  assembleJourneyView,
  attributionLabel,
  journeyCourseLabel,
  journeyWindow,
  parseJourneyCourse,
  parseJourneyPeriod,
  pivotScenarios,
  type JourneyAggregateModel,
  type JourneyCourse,
  type JourneyQuery,
} from "@/lib/admin/journey-report";
import { TRAFFIC_COURSE_SLUG } from "@/lib/learning/course-experience";
import { SITES_COURSE_SLUG } from "@/lib/learning/sites-course";
import { getPrisma } from "@/lib/db/prisma";

const PATH_EVENTS = JOURNEY_FUNNEL[0].events;

export async function loadJourneyDashboard(query: JourneyQuery, now = new Date()) {
  const period = parseJourneyPeriod(query.periodo);
  const course = parseJourneyCourse(query.curso);
  const window = journeyWindow(period, now);
  const prisma = getPrisma();
  const where = Prisma.sql`"occurredAt" >= ${window.start} AND "occurredAt" < ${window.end} AND ${journeyCourseSql(course)}`;
  const funnelSelect = Prisma.join(
    JOURNEY_FUNNEL.map(
      (step) => Prisma.sql`COUNT(DISTINCT "anonymousId") FILTER (WHERE "eventName" IN (${Prisma.join(step.events)}))::int AS ${Prisma.raw(`"${step.key}"`)}`,
    ),
    ", ",
  );

  const [summaryRows, scenarioRows, scenarioCourseRows, choiceRows, sourceRows, campaignRows, lessonRows, transitionRows, orderRows, coverageRows, itemRows, payments, startedRows, completedRows, diagnosticRows, courses] = await Promise.all([
    prisma.$queryRaw<Array<Record<string, number | bigint>>>(Prisma.sql`
      SELECT
        COUNT(DISTINCT "anonymousId")::int AS journeys,
        COUNT(DISTINCT "sessionId")::int AS sessions,
        COUNT(DISTINCT "userId")::int AS authenticated,
        COUNT(DISTINCT "anonymousId") FILTER (WHERE "eventName" = 'diagnostic_started')::int AS diagnostic_started,
        ${funnelSelect}
      FROM journey_event
      WHERE ${where}
    `),
    prisma.$queryRaw<Array<{ scenario: string; event_name: string; journeys: number }>>(Prisma.sql`
      SELECT COALESCE("scenario", '') AS scenario, "eventName" AS event_name, COUNT(DISTINCT "anonymousId")::int AS journeys
      FROM journey_event
      WHERE ${where} AND "eventName" IN (${Prisma.join([...PATH_EVENTS])})
      GROUP BY 1, 2
    `),
    prisma.$queryRaw<Array<{ scenario: string; course_slug: string; journeys: number }>>(Prisma.sql`
      SELECT COALESCE("scenario", '') AS scenario, "courseSlug" AS course_slug, COUNT(DISTINCT "anonymousId")::int AS journeys
      FROM journey_event
      WHERE ${where} AND "eventName" IN (${Prisma.join([...PATH_EVENTS])}) AND "courseSlug" IS NOT NULL
      GROUP BY 1, 2
    `),
    prisma.$queryRaw<Array<{ course_slug: string; journeys: number }>>(Prisma.sql`
      SELECT "courseSlug" AS course_slug, COUNT(DISTINCT "anonymousId")::int AS journeys
      FROM journey_event
      WHERE ${where} AND "eventName" IN (${Prisma.join([...PATH_EVENTS])}) AND "courseSlug" IS NOT NULL
      GROUP BY 1
    `),
    prisma.$queryRaw<Array<{ source: string | null; medium: string | null; journeys: number }>>(Prisma.sql`
      WITH first_event AS (
        SELECT DISTINCT ON ("anonymousId")
          COALESCE(NULLIF(btrim("utmSource"), ''), NULLIF(btrim("leadSource"), '')) AS source,
          COALESCE(NULLIF(btrim("utmMedium"), ''), NULLIF(btrim("leadMedium"), '')) AS medium
        FROM journey_event
        WHERE ${where} AND "anonymousId" IS NOT NULL
        ORDER BY "anonymousId", "occurredAt" ASC, "id" ASC
      )
      SELECT source, medium, COUNT(*)::int AS journeys
      FROM first_event
      GROUP BY source, medium
      ORDER BY journeys DESC, source ASC NULLS LAST
      LIMIT 30
    `),
    prisma.$queryRaw<Array<{ campaign: string; journeys: number }>>(Prisma.sql`
      WITH first_event AS (
        SELECT DISTINCT ON ("anonymousId") NULLIF(btrim("utmCampaign"), '') AS campaign
        FROM journey_event
        WHERE ${where} AND "anonymousId" IS NOT NULL
        ORDER BY "anonymousId", "occurredAt" ASC, "id" ASC
      )
      SELECT campaign, COUNT(*)::int AS journeys
      FROM first_event
      WHERE campaign IS NOT NULL
      GROUP BY campaign
      ORDER BY journeys DESC, campaign ASC
      LIMIT 10
    `),
    prisma.$queryRaw<Array<{ course_slug: string | null; lesson_slug: string | null; journeys: number; starts: number; completions: number }>>(Prisma.sql`
      SELECT
        "courseSlug" AS course_slug,
        "lessonSlug" AS lesson_slug,
        COUNT(DISTINCT "anonymousId") FILTER (WHERE "eventName" = 'course_free_start')::int AS journeys,
        COUNT(*) FILTER (WHERE "eventName" = 'course_free_start')::int AS starts,
        COUNT(DISTINCT "anonymousId") FILTER (WHERE "eventName" = 'lesson_completed')::int AS completions
      FROM journey_event
      WHERE ${where} AND "eventName" IN ('course_free_start', 'lesson_completed')
      GROUP BY 1, 2
      HAVING COUNT(*) FILTER (WHERE "eventName" = 'course_free_start') > 0
      ORDER BY journeys DESC, lesson_slug ASC NULLS LAST
    `),
    prisma.$queryRaw<Array<{ source_slug: string | null; target_slug: string | null; journeys: number; clicks: number }>>(Prisma.sql`
      SELECT
        "sourceCourseSlug" AS source_slug,
        "targetCourseSlug" AS target_slug,
        COUNT(DISTINCT "anonymousId")::int AS journeys,
        COUNT(*)::int AS clicks
      FROM journey_event
      WHERE ${where} AND "eventName" = 'course_complementary_click'
      GROUP BY 1, 2
      ORDER BY journeys DESC, source_slug ASC NULLS LAST
    `),
    prisma.$queryRaw<Array<{ orders: number; buyers: number }>>(Prisma.sql`
      SELECT COUNT(*)::int AS orders, COUNT(DISTINCT o."userId")::int AS buyers
      FROM "order" o
      WHERE o.status = 'PAID'
        AND o."createdAt" >= ${window.start}
        AND o."createdAt" < ${window.end}
        AND ${orderCourseSql(course)}
    `),
    prisma.$queryRaw<Array<{ covered: number }>>(Prisma.sql`
      WITH paid AS (
        SELECT DISTINCT o."userId" AS user_id
        FROM "order" o
        WHERE o.status = 'PAID'
          AND o."createdAt" >= ${window.start}
          AND o."createdAt" < ${window.end}
          AND ${orderCourseSql(course)}
      ),
      journey AS (
        SELECT DISTINCT e."userId" AS user_id
        FROM journey_event e
        WHERE e."eventName" = 'purchase_completed'
          AND e."userId" IS NOT NULL
          AND e."occurredAt" >= ${window.start}
          AND e."occurredAt" < ${window.end}
          AND ${journeyCourseSql(course, "e")}
      )
      SELECT COUNT(*)::int AS covered
      FROM paid p
      INNER JOIN journey j ON j.user_id = p.user_id
    `),
    course === "all"
      ? Promise.resolve([{ cents: 0 }])
      : prisma.$queryRaw<Array<{ cents: number }>>(Prisma.sql`
          SELECT COALESCE(SUM(i."finalPriceCents"), 0)::int AS cents
          FROM order_item i
          JOIN "order" o ON o.id = i."orderId"
          LEFT JOIN course c ON c.id = i."courseId"
          LEFT JOIN module m ON m.id = i."moduleId"
          LEFT JOIN course mc ON mc.id = m."courseId"
          LEFT JOIN lesson l ON l.id = i."lessonId"
          LEFT JOIN module lm ON lm.id = l."moduleId"
          LEFT JOIN course lc ON lc.id = lm."courseId"
          WHERE o.status = 'PAID'
            AND o."createdAt" >= ${window.start}
            AND o."createdAt" < ${window.end}
            AND (c.slug = ${course} OR mc.slug = ${course} OR lc.slug = ${course})
        `),
    course === "all"
      ? prisma.payment.findMany({
          where: {
            status: { in: ["APPROVED", "PARTIALLY_REFUNDED"] },
            OR: [
              { approvedAt: { gte: window.start, lt: window.end } },
              { AND: [{ approvedAt: null }, { createdAt: { gte: window.start, lt: window.end } }] },
            ],
          },
          select: { status: true, amountCents: true, refundedAmountCents: true },
        })
      : Promise.resolve([]),
    prisma.$queryRaw<Array<{ users: number }>>(Prisma.sql`
      SELECT COUNT(DISTINCT p."userId")::int AS users
      FROM lesson_progress p
      JOIN lesson l ON l.id = p."lessonId"
      JOIN module m ON m.id = l."moduleId"
      JOIN course c ON c.id = m."courseId"
      WHERE p."startedAt" >= ${window.start}
        AND p."startedAt" < ${window.end}
        AND ${course === "all" ? Prisma.sql`TRUE` : Prisma.sql`c.slug = ${course}`}
    `),
    prisma.$queryRaw<Array<{ users: number }>>(Prisma.sql`
      SELECT COUNT(DISTINCT p."userId")::int AS users
      FROM lesson_progress p
      JOIN lesson l ON l.id = p."lessonId"
      JOIN module m ON m.id = l."moduleId"
      JOIN course c ON c.id = m."courseId"
      WHERE p."completedAt" IS NOT NULL
        AND p."completedAt" >= ${window.start}
        AND p."completedAt" < ${window.end}
        AND ${course === "all" ? Prisma.sql`TRUE` : Prisma.sql`c.slug = ${course}`}
    `),
    course === "all"
      ? prisma.$queryRaw<Array<{ users: number }>>(Prisma.sql`
          SELECT COUNT(DISTINCT "userId")::int AS users
          FROM diagnostic
          WHERE status = 'COMPLETED'
            AND "completedAt" >= ${window.start}
            AND "completedAt" < ${window.end}
        `)
      : Promise.resolve([]),
    prisma.course.findMany({
      where: { slug: { in: [TRAFFIC_COURSE_SLUG, SITES_COURSE_SLUG] } },
      select: { slug: true, title: true },
    }),
  ]);

  const lessonSlugs = [...new Set(lessonRows.map((row) => row.lesson_slug).filter((slug): slug is string => Boolean(slug)))];
  const lessons = lessonSlugs.length
    ? await prisma.lesson.findMany({ where: { slug: { in: lessonSlugs } }, select: { slug: true, title: true } })
    : [];
  const courseTitles = Object.fromEntries(courses.map((item) => [item.slug, item.title]));
  const lessonTitles = Object.fromEntries(lessons.map((item) => [item.slug, item.title]));
  const summary = summaryRows[0] ?? {};
  const funnel = JOURNEY_FUNNEL.map((step) => ({ key: step.key, label: step.label, count: asInt(summary[step.key]) }));
  const choiceCounts = new Map(choiceRows.map((row) => [row.course_slug, asInt(row.journeys)]));

  const model: JourneyAggregateModel = {
    period,
    course,
    journeys: asInt(summary.journeys),
    sessions: asInt(summary.sessions),
    authenticated: asInt(summary.authenticated),
    funnel,
    paidOrders: asInt(orderRows[0]?.orders),
    paidBuyers: asInt(orderRows[0]?.buyers),
    revenueCents: course === "all" ? receivedRevenueCents(payments) : null,
    itemValueCents: course === "all" ? null : asInt(itemRows[0]?.cents),
    coverageWithJourney: asInt(coverageRows[0]?.covered),
    scenarios: pivotScenarios({
      cells: scenarioRows.map((row) => ({ scenario: row.scenario, eventName: row.event_name, journeys: asInt(row.journeys) })),
      courses: scenarioCourseRows.map((row) => ({ scenario: row.scenario, courseSlug: row.course_slug, journeys: asInt(row.journeys) })),
    }),
    courseChoices: [TRAFFIC_COURSE_SLUG, SITES_COURSE_SLUG]
      .map((slug) => ({ slug, label: journeyCourseLabel(slug, courseTitles), count: choiceCounts.get(slug) ?? 0 }))
      .filter((row) => row.count > 0),
    sources: topCounts(sourceRows.map((row) => ({ label: attributionLabel(row.source, row.medium), count: asInt(row.journeys) }))),
    campaigns: campaignRows.map((row) => ({ label: row.campaign, count: asInt(row.journeys) })),
    freeLessons: lessonRows.map((row) => ({
      courseLabel: journeyCourseLabel(row.course_slug, courseTitles),
      lessonTitle: (row.lesson_slug && lessonTitles[row.lesson_slug]) || row.lesson_slug || "Aula sem slug",
      journeys: asInt(row.journeys),
      starts: asInt(row.starts),
      completions: asInt(row.completions),
    })),
    transitions: transitionRows.map((row) => ({
      from: journeyCourseLabel(row.source_slug, courseTitles),
      to: journeyCourseLabel(row.target_slug, courseTitles),
      journeys: asInt(row.journeys),
      clicks: asInt(row.clicks),
    })),
    diagnosticStarted: asInt(summary.diagnostic_started),
    lessonsStarted: asInt(startedRows[0]?.users),
    lessonsCompleted: asInt(completedRows[0]?.users),
    diagnosticsCompleted: course === "all" ? asInt(diagnosticRows[0]?.users) : null,
  };

  return assembleJourneyView(model);
}

function journeyCourseSql(course: JourneyCourse, alias: "" | "e" = ""): Prisma.Sql {
  if (course === "all") return Prisma.sql`TRUE`;
  const courseSlug = column(alias, "courseSlug");
  const source = column(alias, "sourceCourseSlug");
  const target = column(alias, "targetCourseSlug");
  return Prisma.sql`(
    ${courseSlug} = ${course}
    OR (${courseSlug} IS NULL AND (${source} = ${course} OR ${target} = ${course}))
  )`;
}

function orderCourseSql(course: JourneyCourse): Prisma.Sql {
  if (course === "all") return Prisma.sql`TRUE`;
  return Prisma.sql`EXISTS (
    SELECT 1
    FROM order_item i
    LEFT JOIN course c ON c.id = i."courseId"
    LEFT JOIN module m ON m.id = i."moduleId"
    LEFT JOIN course mc ON mc.id = m."courseId"
    LEFT JOIN lesson l ON l.id = i."lessonId"
    LEFT JOIN module lm ON lm.id = l."moduleId"
    LEFT JOIN course lc ON lc.id = lm."courseId"
    WHERE i."orderId" = o.id
      AND (c.slug = ${course} OR mc.slug = ${course} OR lc.slug = ${course})
  )`;
}

function column(alias: string, name: string) {
  return Prisma.raw(alias ? `${alias}."${name}"` : `"${name}"`);
}

function asInt(value: number | bigint | undefined) {
  if (typeof value === "bigint") return Number(value);
  return value ?? 0;
}

function topCounts(rows: Array<{ label: string; count: number }>) {
  const counts = new Map<string, number>();
  for (const row of rows) counts.set(row.label, (counts.get(row.label) ?? 0) + row.count);
  return [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
    .slice(0, 10);
}
