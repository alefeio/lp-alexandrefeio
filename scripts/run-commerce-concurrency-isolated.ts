import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { assertIsolatedCommerceLiveConnection } from "../src/lib/db/urls";

function loadIsolatedEnvFile(path: string) {
  const raw = readFileSync(path, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq);
    const value = trimmed.slice(eq + 1);
    process.env[key] = value;
  }
}

async function main() {
  loadIsolatedEnvFile(".env.commerce-isolated.local");
  delete process.env.VERCEL_ENV;
  delete process.env.UNIT_TEST_ISOLATION;

  const probed = await assertIsolatedCommerceLiveConnection(process.env);
  console.info("[run-commerce-concurrency-isolated] gate OK", {
    host: probed.declared.host,
    port: probed.declared.port,
    database: probed.declared.database,
    valueHash12: probed.declared.valueHash12,
    liveVersion: probed.live.version,
  });

  const child = spawn(
    "npx",
    ["tsx", "--test", "tests/database-live/commerce-concurrency.database.test.ts"],
    {
      stdio: "inherit",
      shell: true,
      env: { ...process.env },
    },
  );
  child.on("exit", (code) => process.exit(code ?? 1));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
