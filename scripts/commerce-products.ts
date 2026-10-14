import { config as loadEnv } from "dotenv";
import { formatCents, formatPlan, runCommerceProducts } from "../src/lib/commerce/product-activation";
import { getPrisma } from "../src/lib/db/prisma";

loadEnv({ path: ".env.local" });
loadEnv({ path: ".env" });

const request = parseArgs(process.argv.slice(2));

runCommerceProducts(getPrisma(), request)
  .then((result) => {
    if (request.action === "list") {
      for (const row of result.inventory) {
        const kind = row.kind === "lesson" ? "aula" : row.kind === "module" ? "módulo" : "curso";
        const allow = row.allowed ? "allowlist" : "bloqueado";
        console.log(`${kind}\t${row.slug}\t${row.current}\t${formatCents(row.priceCents)}\t${allow}`);
      }
    } else {
      for (const plan of result.plans) {
        console.log(formatPlan(plan));
        console.log("");
      }
    }
    if (result.message) console.log(result.message);
    if (!result.ok) process.exit(1);
  })
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : "commerce products failed");
    process.exit(1);
  });

function parseArgs(argv: string[]): { action: "list" | "enable" | "disable"; slugs: string[]; apply: boolean } {
  const enable: string[] = [];
  const disable: string[] = [];
  let apply = false;
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index] ?? "";
    if (arg === "--apply") {
      apply = true;
      continue;
    }
    if (arg === "--enable" || arg === "--disable") {
      const slug = argv[index + 1];
      if (!slug || slug.startsWith("--")) throw new Error(`Informe o slug depois de ${arg}.`);
      if (arg === "--enable") enable.push(slug);
      else disable.push(slug);
      index += 1;
      continue;
    }
    throw new Error(`Argumento desconhecido: ${arg}`);
  }
  if (enable.length > 0 && disable.length > 0) throw new Error("Use só --enable ou só --disable.");
  if (enable.length > 0) return { action: "enable", slugs: enable, apply };
  if (disable.length > 0) return { action: "disable", slugs: disable, apply };
  return { action: "list", slugs: [], apply: false };
}
