import assert from "node:assert/strict";
import { config as loadEnv } from "dotenv";
import test from "node:test";
import { commercePatch, commerceStatusForCreate } from "../../src/lib/learning/catalog-commerce";
import { FIRST_COURSE_SLUG } from "../../src/lib/learning/first-course";
import { LESSON_04_SLUG } from "../../src/lib/learning/lesson-04";
import { LESSON_05_SLUG } from "../../src/lib/learning/lesson-05";
import { runCommerceProducts } from "../../src/lib/commerce/product-activation";

loadEnv({ path: ".env.local" });

const developmentEnv = { DATABASE_ENV: "development", COMMERCE_CATALOG_CONFIRM: "shared" };

test("preço pode mudar sem alterar a disponibilidade", async () => {
  const { assertMigrationTargetAllowed } = await import("../../src/lib/db/urls");
  assertMigrationTargetAllowed();
  const { getPrisma } = await import("../../src/lib/db/prisma");
  const prisma = getPrisma();
  const stamp = Date.now();
  const course = await prisma.course.create({
    data: { slug: `catalog-price-${stamp}`, title: "Fixture", description: "Teste", status: "PUBLISHED", commerceStatus: "NOT_FOR_SALE" },
  });
  const moduleRow = await prisma.module.create({
    data: { courseId: course.id, slug: "mod", title: "Módulo", description: "Teste", status: "PUBLISHED", commerceStatus: "AVAILABLE", bundlePriceCents: 1000 },
  });
  const lesson = await prisma.lesson.create({
    data: {
      moduleId: moduleRow.id,
      slug: `catalog-price-${stamp}`,
      title: "Aula",
      summary: "Resumo",
      status: "PUBLISHED",
      accessType: "PAID",
      commerceStatus: commerceStatusForCreate(),
      priceCents: 1000,
      publishedAt: new Date(),
    },
  });
  try {
    assert.equal(lesson.commerceStatus, "NOT_FOR_SALE");
    await prisma.lesson.update({ where: { id: lesson.id }, data: { commerceStatus: "AVAILABLE" } });
    await prisma.lesson.update({ where: { id: lesson.id }, data: { priceCents: 2990, title: "Aula atualizada", ...commercePatch(true) } });
    const kept = await prisma.lesson.findUniqueOrThrow({ where: { id: lesson.id } });
    assert.equal(kept.commerceStatus, "AVAILABLE");
    assert.equal(kept.priceCents, 2990);
    await prisma.lesson.update({ where: { id: lesson.id }, data: { ...commercePatch(true) } });
    assert.equal((await prisma.lesson.findUniqueOrThrow({ where: { id: lesson.id } })).commerceStatus, "AVAILABLE");
    await prisma.module.update({ where: { id: moduleRow.id }, data: { bundlePriceCents: 5790, ...commercePatch(true) } });
    assert.equal((await prisma.module.findUniqueOrThrow({ where: { id: moduleRow.id } })).commerceStatus, "AVAILABLE");
  } finally {
    await prisma.course.delete({ where: { id: course.id } });
  }
});

test("dry-run não grava no banco compartilhado", async () => {
  const { assertMigrationTargetAllowed } = await import("../../src/lib/db/urls");
  assertMigrationTargetAllowed();
  const { getPrisma } = await import("../../src/lib/db/prisma");
  const prisma = getPrisma();
  const before = await prisma.lesson.findUniqueOrThrow({ where: { slug: LESSON_04_SLUG }, select: { commerceStatus: true } });
  const flags = { enabled: process.env.COMMERCE_ENABLED, ready: process.env.COMMERCE_PRODUCTION_READY };
  const dry = await runCommerceProducts(prisma, { action: "enable", slugs: [LESSON_04_SLUG], apply: false }, developmentEnv);
  assert.equal(dry.written, false);
  assert.equal(dry.plans[0]?.allowed, true);
  assert.equal(dry.plans[0]?.intended, "AVAILABLE");
  const blocked = await runCommerceProducts(
    prisma,
    { action: "enable", slugs: [LESSON_04_SLUG], apply: true },
    { DATABASE_ENV: "production" },
  );
  assert.equal(blocked.ok, false);
  assert.equal(blocked.written, false);
  const local = await runCommerceProducts(
    prisma,
    { action: "enable", slugs: [LESSON_04_SLUG], apply: true },
    { DATABASE_ENV: "development" },
  );
  assert.equal(local.ok, false);
  assert.equal(local.written, false);
  const after = await prisma.lesson.findUniqueOrThrow({ where: { slug: LESSON_04_SLUG }, select: { commerceStatus: true } });
  assert.equal(after.commerceStatus, before.commerceStatus);
  assert.equal(process.env.COMMERCE_ENABLED, flags.enabled);
  assert.equal(process.env.COMMERCE_PRODUCTION_READY, flags.ready);
});

test("ativação em transação, desativação e catálogo preservam venda e entitlement", async () => {
  const { assertMigrationTargetAllowed } = await import("../../src/lib/db/urls");
  assertMigrationTargetAllowed();
  const { getPrisma } = await import("../../src/lib/db/prisma");
  const { seedLesson04Content } = await import("../../src/lib/learning/seed-lesson-04");
  const prisma = getPrisma();
  const stamp = Date.now();

  await assert.rejects(
    () =>
      prisma.$transaction(
        async (tx) => {
          const enabled = await runCommerceProducts(tx, { action: "enable", slugs: [LESSON_04_SLUG], apply: true }, developmentEnv);
          assert.equal(enabled.written, true);
          assert.equal((await tx.lesson.findUniqueOrThrow({ where: { slug: LESSON_04_SLUG } })).commerceStatus, "AVAILABLE");
          const lessonFive = await runCommerceProducts(tx, { action: "enable", slugs: [LESSON_05_SLUG], apply: true }, developmentEnv);
          assert.equal(lessonFive.written, true);
          const moduleSale = await runCommerceProducts(
            tx,
            { action: "enable", slugs: ["planeje-antes-de-anunciar"], apply: true },
            developmentEnv,
          );
          assert.equal(moduleSale.written, true);
          await seedLesson04Content(tx as unknown as Parameters<typeof seedLesson04Content>[0], { preserveCommerceStatus: true });
          const afterSeed = await tx.lesson.findUniqueOrThrow({ where: { slug: LESSON_04_SLUG } });
          assert.equal(afterSeed.commerceStatus, "AVAILABLE");
          assert.equal(afterSeed.priceCents, 2990);
          throw new Error("rollback-test");
        },
        { timeout: 20000 },
      ),
    /rollback-test/,
  );

  assert.equal((await prisma.lesson.findUniqueOrThrow({ where: { slug: LESSON_04_SLUG } })).commerceStatus, "NOT_FOR_SALE");
  assert.equal((await prisma.lesson.findUniqueOrThrow({ where: { slug: LESSON_05_SLUG } })).commerceStatus, "NOT_FOR_SALE");
  assert.equal(
    (await prisma.module.findFirstOrThrow({ where: { slug: "planeje-antes-de-anunciar", course: { slug: FIRST_COURSE_SLUG } } })).commerceStatus,
    "NOT_FOR_SALE",
  );

  const course = await prisma.course.create({
    data: { slug: `sale-off-${stamp}`, title: "Fixture", description: "Teste", status: "PUBLISHED", commerceStatus: "NOT_FOR_SALE" },
  });
  try {
    const moduleRow = await prisma.module.create({
      data: { courseId: course.id, slug: "mod", title: "Módulo", description: "Teste", status: "PUBLISHED", commerceStatus: "NOT_FOR_SALE" },
    });
    const lesson = await prisma.lesson.create({
      data: {
        moduleId: moduleRow.id,
        slug: `sale-off-${stamp}`,
        title: "Aula comprada",
        summary: "Resumo",
        status: "PUBLISHED",
        accessType: "PAID",
        commerceStatus: "AVAILABLE",
        priceCents: 2990,
        publishedAt: new Date(),
      },
    });
    const user = await prisma.user.create({
      data: { id: `sale-off-${stamp}`, name: "Aluno", email: `sale-off-${stamp}@example.com`, emailVerified: true, createdAt: new Date(), updatedAt: new Date() },
    });
    const order = await prisma.order.create({
      data: { userId: user.id, status: "PAID", subtotalCents: 2990, creditCents: 0, totalCents: 2990 },
    });
    const item = await prisma.orderItem.create({
      data: {
        orderId: order.id,
        productType: "LESSON",
        lessonId: lesson.id,
        titleSnapshot: "Aula comprada",
        listPriceCents: 2990,
        creditAppliedCents: 0,
        finalPriceCents: 2990,
      },
    });
    await prisma.payment.create({
      data: { orderId: order.id, provider: "MERCADO_PAGO", idempotencyKey: `sale-off-${stamp}`, status: "APPROVED", amountCents: 2990 },
    });
    const entitlement = await prisma.entitlement.create({
      data: { userId: user.id, lessonId: lesson.id, orderItemId: item.id, status: "ACTIVE" },
    });
    const closed = await runCommerceProducts(prisma, { action: "disable", slugs: [lesson.slug], apply: true }, developmentEnv);
    assert.equal(closed.written, true);
    assert.equal((await prisma.lesson.findUniqueOrThrow({ where: { id: lesson.id } })).commerceStatus, "NOT_FOR_SALE");
    const kept = await prisma.entitlement.findUniqueOrThrow({ where: { id: entitlement.id } });
    assert.equal(kept.status, "ACTIVE");
    assert.equal(await prisma.order.count({ where: { id: order.id } }), 1);
    assert.equal(await prisma.payment.count({ where: { orderId: order.id } }), 1);
    const refused = await runCommerceProducts(prisma, { action: "enable", slugs: [FIRST_COURSE_SLUG], apply: true }, developmentEnv);
    assert.equal(refused.written, false);
    assert.equal((await prisma.course.findUniqueOrThrow({ where: { slug: FIRST_COURSE_SLUG } })).commerceStatus, "NOT_FOR_SALE");
  } finally {
    await prisma.user.deleteMany({ where: { id: `sale-off-${stamp}` } });
    await prisma.course.delete({ where: { id: course.id } });
  }
});
