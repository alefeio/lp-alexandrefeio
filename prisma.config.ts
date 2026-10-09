import { config as loadEnv } from "dotenv";
import { defineConfig } from "prisma/config";
import { getMigrationDatabaseUrl } from "./src/lib/db/urls";

loadEnv({ path: ".env.local" });
loadEnv({ path: ".env" });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: getMigrationDatabaseUrl(),
  },
});
