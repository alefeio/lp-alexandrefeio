import { config as loadEnv } from "dotenv";
import { assertMigrationTargetAllowed, sharedCatalogWriteAllowed } from "../src/lib/db/urls";
import { deployLearningCatalog } from "../src/lib/learning/catalog-deploy";

loadEnv({ path: ".env.local" });
loadEnv({ path: ".env" });
assertMigrationTargetAllowed();

const write = sharedCatalogWriteAllowed();
if (!write.ok) {
  console.error(write.message);
  process.exit(1);
}

// O banco é compartilhado. O seed preserva commerceStatus e não apaga uso de aluno.
deployLearningCatalog({ preserveCommerceStatus: true })
  .then((report) => {
    console.log(JSON.stringify(report));
  })
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : "seed failed");
    process.exit(1);
  });
