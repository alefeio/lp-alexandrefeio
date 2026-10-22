import type { LandingPageAction } from "@/lib/landing-page/actions";
import type { LandingPageMeasurementEvent } from "@/lib/landing-page/measurement/schema";

/**
 * Contagem diária. Não guarda texto, e-mail, telefone, URL nem referrer.
 * Visitante único fica DEFERRED: sem fingerprint, cookie persistente ou id de sessão.
 * A taxa FORM_START → FORM_SUBMIT é uma razão de contagens, não de pessoas.
 */
export type LandingPageMetricDailyRecord = {
  landingPageProjectId: string;
  publicationId: string;
  date: string;
  eventType: LandingPageMeasurementEvent;
  count: number;
};

export type LandingPageMetricIncrement = {
  landingPageProjectId: string;
  publicationId: string;
  date: string;
  eventType: LandingPageMeasurementEvent;
};

export type LandingPageMetricStore = {
  increment(input: LandingPageMetricIncrement): Promise<LandingPageMetricDailyRecord>;
  listForProject(landingPageProjectId: string): Promise<LandingPageMetricDailyRecord[]>;
};

export function landingPageMetricDate(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export function createMemoryLandingPageMetricStore(): LandingPageMetricStore {
  const rows = new Map<string, LandingPageMetricDailyRecord>();

  function key(input: LandingPageMetricIncrement): string {
    return `${input.landingPageProjectId}|${input.publicationId}|${input.date}|${input.eventType}`;
  }

  return {
    async increment(input) {
      const id = key(input);
      const current = rows.get(id);
      if (current) {
        current.count += 1;
        return current;
      }
      const created = { ...input, count: 1 };
      rows.set(id, created);
      return created;
    },
    async listForProject(landingPageProjectId) {
      return [...rows.values()].filter((row) => row.landingPageProjectId === landingPageProjectId);
    },
  };
}

/**
 * Um clique em WhatsApp conta a ação genérica e o canal.
 * A conversão principal usa um único tipo, então o clique não entra duas vezes nela.
 */
export function landingPageClickEvents(actionType: LandingPageAction["type"]): LandingPageMeasurementEvent[] {
  if (actionType === "WHATSAPP") return ["CTA_CLICK", "WHATSAPP_CLICK"];
  return ["CTA_CLICK"];
}

export type LandingPageMeasurementSource = "PUBLIC" | "PREVIEW" | "EDITOR" | "COURSE";

export type LandingPageMeasurementSink = {
  increment(input: LandingPageMetricIncrement): Promise<LandingPageMetricDailyRecord>;
};

/**
 * Preview, editor e aula não gravam métrica.
 * Falha do sink não deve ser tratada aqui como falha da ação de negócio.
 */
export async function recordLandingPageMeasurementEvents(input: {
  source: LandingPageMeasurementSource;
  sink: LandingPageMeasurementSink;
  landingPageProjectId: string;
  publicationId: string;
  events: LandingPageMeasurementEvent[];
  date: string;
}): Promise<{ recorded: boolean }> {
  if (input.source !== "PUBLIC") return { recorded: false };
  for (const eventType of input.events) {
    await input.sink.increment({
      landingPageProjectId: input.landingPageProjectId,
      publicationId: input.publicationId,
      date: input.date,
      eventType,
    });
  }
  return { recorded: true };
}
