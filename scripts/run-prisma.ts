import { spawn } from "node:child_process";
import { config as loadEnv } from "dotenv";
import { assertMigrationTargetAllowed } from "../src/lib/db/urls";

loadEnv({ path: ".env.local" });
loadEnv({ path: ".env" });

const args = process.argv.slice(2);
if (args.length === 0) {
  throw new Error("Missing prisma arguments");
}

// `vercel env pull` / link pode gravar VERCEL=1 no .env.local; isso não é runtime Vercel.
if (process.env.MIGRATE_DEPLOY_CONFIRM === "production") {
  delete process.env.VERCEL;
}

assertMigrationTargetAllowed(process.env, args);

const child = spawn("npx", ["prisma", ...args], {
  stdio: "inherit",
  shell: true,
  env: process.env,
});

child.on("exit", (code) => {
  process.exit(code ?? 1);
});
