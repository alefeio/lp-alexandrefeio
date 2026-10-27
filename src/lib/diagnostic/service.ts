import type { Prisma } from "@/generated/prisma/client";
import { getPrisma } from "@/lib/db/prisma";
import { DIAGNOSTIC_VERSION, QUESTIONS } from "@/lib/diagnostic/definition";
import { answersComplete, parseAnswers, resultSnapshotSchema, scoreDiagnostic, type DiagnosticAnswers } from "@/lib/diagnostic/score";
import { ownedProject } from "@/lib/project/service";

function hasAnsweredQuestion(answers: DiagnosticAnswers) {
  return QUESTIONS.some((question) => Boolean(answers[question.id as keyof DiagnosticAnswers]));
}

export async function getDiagnosticForUser(userId: string, projectId: string, diagnosticId: string) {
  return getPrisma().diagnostic.findFirst({
    where: { id: diagnosticId, userId, projectId },
    include: {
      recommendations: {
        orderBy: { createdAt: "asc" },
        include: {
          lesson: { select: { slug: true, title: true, accessType: true, status: true, commerceStatus: true } },
          tasks: { where: { status: { in: ["TODO", "IN_PROGRESS"] } }, take: 1 },
        },
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
  const answers = parseAnswers(rawAnswers);
  if (!answers) return { ok: false as const, message: "Resposta inválida." };

  const prisma = getPrisma();
  const currentStep = Math.min(Math.max(Math.trunc(step), 0), QUESTIONS.length);
  const answersJson = JSON.stringify(answers);
  let startedNow = false;

  if (hasAnsweredQuestion(answers)) {
    const started = await prisma.$queryRaw<Array<{ id: string }>>`
      UPDATE "diagnostic"
      SET
        "answers" = ${answersJson}::jsonb,
        "currentStep" = ${currentStep},
        "updatedAt" = NOW()
      WHERE
        "id" = ${diagnosticId}
        AND "userId" = ${userId}
        AND "projectId" = ${projectId}
        AND "status" = 'IN_PROGRESS'
        AND "answers" = '{}'::jsonb
      RETURNING "id"
    `;
    startedNow = started.length === 1;
  }

  if (!startedNow) {
    const updated = await prisma.diagnostic.updateMany({
      where: { id: diagnosticId, userId, projectId, status: "IN_PROGRESS" },
      data: { answers: JSON.parse(answersJson) as Prisma.InputJsonValue, currentStep },
    });
    if (updated.count !== 1) return { ok: false as const, message: "Diagnóstico não encontrado." };
  }

  const saved = await prisma.diagnostic.findUnique({ where: { id: diagnosticId } });
  if (!saved) return { ok: false as const, message: "Diagnóstico não encontrado." };
  return { ok: true as const, diagnostic: saved, startedNow };
}

export async function completeDiagnosticForUser(userId: string, projectId: string, diagnosticId: string) {
  const prisma = getPrisma();
  const diagnostic = await prisma.diagnostic.findFirst({
    where: { id: diagnosticId, userId, projectId },
  });
  if (!diagnostic) return { ok: false as const, message: "Diagnóstico não encontrado." };
  if (diagnostic.status === "COMPLETED") {
    const parsed = resultSnapshotSchema.safeParse(diagnostic.resultSnapshot);
    return {
      ok: true as const,
      diagnosticId: diagnostic.id,
      completedNow: false,
      resultBand: parsed.success ? parsed.data.band : undefined,
    };
  }

  const answers = parseAnswers(diagnostic.answers);
  if (!answers || !answersComplete(answers)) return { ok: false as const, message: "Responda todas as perguntas antes de concluir." };

  const result = scoreDiagnostic(answers);
  const snapshot = resultSnapshotSchema.parse(result);
  const lesson = snapshot.lessonSlug
    ? await prisma.lesson.findFirst({ where: { slug: snapshot.lessonSlug, status: "PUBLISHED" }, select: { id: true } })
    : null;

  const completedNow = await prisma.$transaction(async (tx) => {
    const transitioned = await tx.diagnostic.updateMany({
      where: { id: diagnostic.id, userId, projectId, status: "IN_PROGRESS" },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
        currentStep: QUESTIONS.length,
        overallScore: snapshot.overallScore,
        primaryBottleneck: snapshot.primaryBottleneck,
        dimensionScores: snapshot.dimensionScores,
        resultSnapshot: snapshot,
      },
    });
    if (transitioned.count !== 1) return false;

    await tx.recommendation.create({
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
    });

    return true;
  });

  if (!completedNow) {
    const current = await prisma.diagnostic.findFirst({ where: { id: diagnosticId, userId, projectId } });
    if (!current) return { ok: false as const, message: "Diagnóstico não encontrado." };
    if (current.status === "COMPLETED") {
      const parsed = resultSnapshotSchema.safeParse(current.resultSnapshot);
      return {
        ok: true as const,
        diagnosticId: current.id,
        completedNow: false,
        resultBand: parsed.success ? parsed.data.band : undefined,
      };
    }
    return { ok: false as const, message: "Não foi possível concluir o diagnóstico." };
  }

  return { ok: true as const, diagnosticId: diagnostic.id, completedNow: true, resultBand: snapshot.band };
}

export function publicAnswers(value: unknown): DiagnosticAnswers {
  return parseAnswers(value) ?? {};
}
