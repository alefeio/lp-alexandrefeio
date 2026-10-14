import { config as loadEnv } from "dotenv";
import { sharedCatalogWriteAllowed } from "../src/lib/db/urls";
import { deployLearningCatalog } from "../src/lib/learning/catalog-deploy";

loadEnv({ path: ".env.local" });
loadEnv({ path: ".env" });

const write = sharedCatalogWriteAllowed();
if (!write.ok) {
  console.error(write.message);
  process.exit(1);
}

deployLearningCatalog({ preserveCommerceStatus: true })
  .then((report) => {
    console.log(JSON.stringify(report));
  })
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : "catalog deploy failed");
    process.exit(1);
  });
