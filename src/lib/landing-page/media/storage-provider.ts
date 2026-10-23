import { createApimgLandingPageMediaStorage } from "@/lib/landing-page/media/apimg-storage";
import type { LandingPageMediaStorage } from "@/lib/landing-page/media/storage";

/** Produção da landing page. Testes injetam o adapter falso e não passam por aqui. */
export function createLandingPageMediaStorage(): LandingPageMediaStorage {
  return createApimgLandingPageMediaStorage();
}
