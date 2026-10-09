import { config as loadEnv } from "dotenv";
import { assertMigrationTargetAllowed } from "../src/lib/db/urls";

loadEnv({ path: ".env.local" });
loadEnv({ path: ".env" });

async function main() {
  assertMigrationTargetAllowed();
  const email = process.argv[2]?.trim().toLowerCase();
  if (!email || !email.includes("@")) {
    throw new Error("Informe o e-mail: npx tsx scripts/set-admin.ts pessoa@email.com");
  }

  const { getPrisma } = await import("../src/lib/db/prisma");
  const updated = await getPrisma().user.update({
    where: { email },
    data: { role: "ADMIN" },
    select: { role: true },
  });

  console.log(`role atualizado: ${updated.role}`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "falha";
  console.error(message);
  process.exit(1);
});
