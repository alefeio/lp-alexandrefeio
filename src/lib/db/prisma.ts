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
  const cached = globalForPrisma.prisma;
  if (cached) return cached;

  const client = createPrismaClient();
  globalForPrisma.prisma = client;
  return client;
}
