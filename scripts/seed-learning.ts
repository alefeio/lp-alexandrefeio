import { config as loadEnv } from "dotenv";
import { assertMigrationTargetAllowed } from "../src/lib/db/urls";
import { deployLearningCatalog } from "../src/lib/learning/catalog-deploy";

loadEnv({ path: ".env.local" });
loadEnv({ path: ".env" });
assertMigrationTargetAllowed();

// db:seed fecha a venda de propósito. catalog:deploy preserva o commerceStatus existente.
deployLearningCatalog({ preserveCommerceStatus: false })
  .then((report) => {
    console.log(JSON.stringify(report));
  })
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : "seed failed");
    process.exit(1);
  });
