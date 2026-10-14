import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { getRuntimeDatabaseUrl } from "@/lib/db/urls";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createPrismaClient() {
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString: getRuntimeDatabaseUrl() }),
  });
}

export function getPrisma(): PrismaClient {
  if (process.env.UNIT_TEST_ISOLATION === "1") {
    throw new Error("npm test não acessa o banco compartilhado. Use npm run test:database-live com SHARED_DATABASE_TEST_CONFIRM=true.");
  }
  const cached = globalForPrisma.prisma;
  if (cached) return cached;

  const client = createPrismaClient();
  globalForPrisma.prisma = client;
  return client;
}
