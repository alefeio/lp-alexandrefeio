import { getPrisma } from "@/lib/db/prisma";
import { projectInputSchema, type ProjectInput } from "@/lib/project/schema";

export function ownedProject(userId: string, projectId: string) {
  return { id: projectId, userId };
}

export async function listProjectsForUser(userId: string) {
  return getPrisma().project.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
  });
}

export async function getProjectForUser(userId: string, projectId: string) {
  return getPrisma().project.findFirst({
    where: ownedProject(userId, projectId),
    include: {
      diagnostics: { orderBy: { createdAt: "desc" } },
      recommendations: { orderBy: { createdAt: "desc" }, include: { lesson: { select: { slug: true, title: true, accessType: true, status: true } } } },
    },
  });
}

export async function latestActiveProject(userId: string) {
  return getPrisma().project.findFirst({
    where: { userId, status: "ACTIVE" },
    orderBy: { updatedAt: "desc" },
    include: {
      diagnostics: { orderBy: { createdAt: "desc" } },
      recommendations: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });
}

function projectData(input: ProjectInput) {
  return {
    name: input.name,
    segment: input.segment,
    primaryOffer: input.primaryOffer,
    objective: input.objective,
    usesGoogleAds: input.usesGoogleAds,
    usesMetaAds: input.usesMetaAds,
    destinationType: input.destinationType,
    monthlyMediaBudgetCents: input.monthlyMediaBudgetCents,
    averageTicketCents: input.averageTicketCents,
    websiteUrl: input.websiteUrl,
    serviceArea: input.serviceArea,
  };
}

export async function createProjectForUser(userId: string, raw: unknown) {
  const parsed = projectInputSchema.safeParse(raw);
  if (!parsed.success) return { ok: false as const, message: parsed.error.issues[0]?.message ?? "Revise os campos." };
  const project = await getPrisma().project.create({
    data: { userId, status: "ACTIVE", ...projectData(parsed.data) },
  });
  return { ok: true as const, project };
}

export async function updateProjectForUser(userId: string, projectId: string, raw: unknown) {
  const existing = await getPrisma().project.findFirst({ where: ownedProject(userId, projectId) });
  if (!existing || existing.status !== "ACTIVE") return { ok: false as const, message: "Projeto não encontrado." };
  const parsed = projectInputSchema.safeParse(raw);
  if (!parsed.success) return { ok: false as const, message: parsed.error.issues[0]?.message ?? "Revise os campos." };
  const project = await getPrisma().project.update({
    where: { id: existing.id },
    data: projectData(parsed.data),
  });
  return { ok: true as const, project };
}

export async function archiveProjectForUser(userId: string, projectId: string) {
  const existing = await getPrisma().project.findFirst({ where: ownedProject(userId, projectId) });
  if (!existing) return { ok: false as const, message: "Projeto não encontrado." };
  if (existing.status === "ARCHIVED") return { ok: true as const, project: existing };
  const project = await getPrisma().project.update({
    where: { id: existing.id },
    data: { status: "ARCHIVED", archivedAt: new Date() },
  });
  return { ok: true as const, project };
}
