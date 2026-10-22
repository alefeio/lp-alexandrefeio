import { fail, ok, type LandingPageResult } from "@/lib/landing-page/errors";
import type { LandingPageLeadRecord, LandingPageLeadStore } from "@/lib/landing-page/leads/store";
import type { LandingPageStore } from "@/lib/landing-page/types";

async function ownedProject(store: LandingPageStore, landingPageProjectId: string, userId: string) {
  return store.findByIdForUser(landingPageProjectId, userId);
}

export async function listLandingPageLeads(
  store: LandingPageStore,
  leads: LandingPageLeadStore,
  input: { userId: string; landingPageProjectId: string },
): Promise<LandingPageResult<LandingPageLeadRecord[]>> {
  const project = await ownedProject(store, input.landingPageProjectId, input.userId);
  if (!project) return fail("NOT_FOUND");
  return ok(await leads.listForProject(project.id));
}

export async function getLandingPageLead(
  store: LandingPageStore,
  leads: LandingPageLeadStore,
  input: { userId: string; landingPageProjectId: string; leadId: string },
): Promise<LandingPageResult<LandingPageLeadRecord>> {
  const project = await ownedProject(store, input.landingPageProjectId, input.userId);
  if (!project) return fail("NOT_FOUND");
  const lead = await leads.findById(input.leadId);
  if (!lead || lead.landingPageProjectId !== project.id) return fail("NOT_FOUND");
  return ok(lead);
}

export async function archiveLandingPageLead(
  store: LandingPageStore,
  leads: LandingPageLeadStore,
  input: { userId: string; landingPageProjectId: string; leadId: string },
): Promise<LandingPageResult<LandingPageLeadRecord>> {
  const project = await ownedProject(store, input.landingPageProjectId, input.userId);
  if (!project) return fail("NOT_FOUND");
  const lead = await leads.findById(input.leadId);
  if (!lead || lead.landingPageProjectId !== project.id) return fail("NOT_FOUND");
  const archived = await leads.archive(lead.id);
  if (!archived) return fail("NOT_FOUND");
  return ok(archived);
}
