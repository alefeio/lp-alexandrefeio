import type { WireframeContextV1 } from "@/lib/landing-page/wireframe/context";

/**
 * Fronteira futura. As aulas 4 e 5 vão adaptar sinais pedagógicos para WireframeContextV1.
 * Esta fase não lê resultados de aula e não implementa o adaptador.
 */
export type WireframeCourseAdapter = {
  buildContext(signals: unknown): WireframeContextV1 | Promise<WireframeContextV1>;
};
