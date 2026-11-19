/**
 * Seed mínimo sintético para suítes database-live (ex.: AI idempotency) no Postgres isolado.
 * Não usa Production. Não concede entitlement real.
 */
import { config as loadEnv } from "dotenv";
import { assertIsolatedCommerceLiveConnection } from "../src/lib/db/urls";

loadEnv({ path: ".env.commerce-isolated.local", override: true });

async function main() {
  await assertIsolatedCommerceLiveConnection(process.env);

  const g = globalThis as unknown as { prisma?: unknown };
  delete g.prisma;
  const { getPrisma } = await import("../src/lib/db/prisma");
  const prisma = getPrisma();

  const id = "commerce-qa-seed-user";
  const email = "commerce-qa-seed@example.com";
  const now = new Date();

  await prisma.user.upsert({
    where: { id },
    create: {
      id,
      name: "Commerce QA Seed",
      email,
      emailVerified: true,
      createdAt: now,
      updatedAt: now,
    },
    update: {
      email,
      emailVerified: true,
      updatedAt: now,
    },
  });

  console.info("[seed-commerce-qa-user] ok", { id, email });
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
