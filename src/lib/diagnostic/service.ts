import type { Prisma } from "@/generated/prisma/client";
import { getPrisma } from "@/lib/db/prisma";
import { DIAGNOSTIC_VERSION, QUESTIONS } from "@/lib/diagnostic/definition";
import { answersComplete, parseAnswers, resultSnapshotSchema, scoreDiagnostic, type DiagnosticAnswers } from "@/lib/diagnostic/score";
import { ownedProject } from "@/lib/project/service";

export async function getDiagnosticForUser(userId: string, projectId: string, diagnosticId: string) {
  return getPrisma().diagnostic.findFirst({
    where: { id: diagnosticId, userId, projectId },
    include: {
      recommendations: {
        orderBy: { createdAt: "asc" },
        include: { lesson: { select: { slug: true, title: true, accessType: true, status: true } } },
      },
    },
  });
}

export async function resumeDiagnosticForUser(userId: string, projectId: string) {
  const project = await getPrisma().project.findFirst({ where: { ...ownedProject(userId, projectId), status: "ACTIVE" } });
  if (!project) return null;
  const existing = await getPrisma().diagnostic.findFirst({
    where: { projectId: project.id, userId, status: "IN_PROGRESS" },
    orderBy: { updatedAt: "desc" },
  });
  if (existing) return existing;
  return getPrisma().diagnostic.create({
    data: {
      projectId: project.id,
      userId,
      version: DIAGNOSTIC_VERSION,
      status: "IN_PROGRESS",
      answers: {},
      currentStep: 0,
    },
  });
}

export async function saveDiagnosticProgress(userId: string, projectId: string, diagnosticId: string, rawAnswers: unknown, step: number) {
  const diagnostic = await getPrisma().diagnostic.findFirst({
    where: { id: diagnosticId, userId, projectId, status: "IN_PROGRESS" },
  });
  if (!diagnostic) return { ok: false as const, message: "Diagnóstico não encontrado." };
  const answers = parseAnswers(rawAnswers);
  if (!answers) return { ok: false as const, message: "Resposta inválida." };
  const currentStep = Math.min(Math.max(Math.trunc(step), 0), QUESTIONS.length);
  const saved = await getPrisma().diagnostic.update({
    where: { id: diagnostic.id },
      data: { answers: JSON.parse(JSON.stringify(answers)) as Prisma.InputJsonValue, currentStep },
  });
  return { ok: true as const, diagnostic: saved };
}

export async function completeDiagnosticForUser(userId: string, projectId: string, diagnosticId: string) {
  const prisma = getPrisma();
  const diagnostic = await prisma.diagnostic.findFirst({
    where: { id: diagnosticId, userId, projectId },
  });
  if (!diagnostic) return { ok: false as const, message: "Diagnóstico não encontrado." };
  if (diagnostic.status === "COMPLETED") return { ok: true as const, diagnosticId: diagnostic.id };

  const answers = parseAnswers(diagnostic.answers);
  if (!answers || !answersComplete(answers)) return { ok: false as const, message: "Responda todas as perguntas antes de concluir." };

  const result = scoreDiagnostic(answers);
  const snapshot = resultSnapshotSchema.parse(result);
  const lesson = snapshot.lessonSlug
    ? await prisma.lesson.findFirst({ where: { slug: snapshot.lessonSlug, status: "PUBLISHED" }, select: { id: true } })
    : null;

  await prisma.$transaction([
    prisma.diagnostic.update({
      where: { id: diagnostic.id },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
        currentStep: QUESTIONS.length,
        overallScore: snapshot.overallScore,
        primaryBottleneck: snapshot.primaryBottleneck,
        dimensionScores: snapshot.dimensionScores,
        resultSnapshot: snapshot,
      },
    }),
    prisma.recommendation.create({
      data: {
        projectId,
        diagnosticId: diagnostic.id,
        type: snapshot.recommendationType,
        priority: snapshot.recommendationPriority,
        title: snapshot.nextStepTitle,
        description: snapshot.nextStepDescription,
        rationale: snapshot.primaryBottleneck
          ? `Gargalo principal: ${snapshot.primaryBottleneck}. A nota geral não substitui esse ponto.`
          : "Nenhuma dimensão crítica ficou abaixo da base desta versão.",
        lessonId: lesson?.id ?? null,
      },
    }),
  ]);

  return { ok: true as const, diagnosticId: diagnostic.id };
}

export function publicAnswers(value: unknown): DiagnosticAnswers {
  return parseAnswers(value) ?? {};
}
