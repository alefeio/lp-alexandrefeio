import { config as loadEnv } from "dotenv";
import { createPrismaJourneyRetentionRepository } from "../src/lib/product-journey/repository";
import { formatJourneyRetentionReport, runJourneyRetention } from "../src/lib/product-journey/retention";

loadEnv({ path: ".env.local" });
loadEnv({ path: ".env" });

async function main() {
  const execute = process.argv.slice(2).includes("--execute");
  const report = await runJourneyRetention({
    execute,
    repository: createPrismaJourneyRetentionRepository(),
  });
  console.log(formatJourneyRetentionReport(report));
}

void main();
