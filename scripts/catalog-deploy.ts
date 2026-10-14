import { config as loadEnv } from "dotenv";
import { deployLearningCatalog } from "../src/lib/learning/catalog-deploy";
import { readDatabaseEnvLabel } from "../src/lib/db/urls";

loadEnv({ path: ".env.local" });
loadEnv({ path: ".env" });

const label = readDatabaseEnvLabel();
if (process.env.VERCEL_ENV === "production") {
  throw new Error("catalog:deploy não roda dentro do runtime de production.");
}
if (label === "production") {
  if (process.env.CATALOG_DEPLOY_CONFIRM !== "production") {
    throw new Error("catalog:deploy em production exige CATALOG_DEPLOY_CONFIRM=production.");
  }
} else if (label !== "development") {
  throw new Error("catalog:deploy só aceita DATABASE_ENV=development ou production confirmado.");
}

deployLearningCatalog({ preserveCommerceStatus: true })
  .then((report) => {
    console.log(JSON.stringify(report));
  })
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : "catalog deploy failed");
    process.exit(1);
  });
