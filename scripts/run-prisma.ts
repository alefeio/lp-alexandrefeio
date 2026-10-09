import { spawn } from "node:child_process";
import { config as loadEnv } from "dotenv";
import { assertMigrationTargetAllowed } from "../src/lib/db/urls";

loadEnv({ path: ".env.local" });
loadEnv({ path: ".env" });

assertMigrationTargetAllowed();

const args = process.argv.slice(2);
if (args.length === 0) {
  throw new Error("Missing prisma arguments");
}

const child = spawn("npx", ["prisma", ...args], {
  stdio: "inherit",
  shell: true,
  env: process.env,
});

child.on("exit", (code) => {
  process.exit(code ?? 1);
});
