import { createPrismaLandingPageRetentionRepository } from "../src/lib/landing-page/retention/prisma";
import { formatLandingPageRetentionReport, runLandingPageRetention } from "../src/lib/landing-page/retention/service";

const execute = process.argv.slice(2).includes("--execute");
const report = await runLandingPageRetention({
  execute,
  repository: createPrismaLandingPageRetentionRepository(),
});
console.log(formatLandingPageRetentionReport(report));
