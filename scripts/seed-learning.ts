import { config as loadEnv } from "dotenv";
import { assertMigrationTargetAllowed } from "../src/lib/db/urls";
import { deployLearningCatalog } from "../src/lib/learning/catalog-deploy";

loadEnv({ path: ".env.local" });
loadEnv({ path: ".env" });
assertMigrationTargetAllowed();

deployLearningCatalog()
  .then((report) => {
    console.log(JSON.stringify(report));
  })
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : "seed failed");
    process.exit(1);
  });
