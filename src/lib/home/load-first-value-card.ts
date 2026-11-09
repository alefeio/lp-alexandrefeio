import {
  loadFirstValueRecommendation,
  presentFirstValueRecommendation,
  type FirstValueCardViewModel,
} from "@/lib/learning/first-value";

/**
 * Carrega o card de primeira conquista para o dashboard.
 * `userId` deve vir de `requireSession()` — nunca de input de cliente.
 * Erro operacional → null (preserva dashboard). Falha de auth do caller não é engolida aqui.
 */
export async function loadFirstValueCardForDashboard(
  userId: string,
  now = new Date(),
): Promise<FirstValueCardViewModel | null> {
  if (!userId || typeof userId !== "string") {
    throw new Error("FIRST_VALUE_USER_REQUIRED");
  }
  try {
    const { recommendation } = await loadFirstValueRecommendation(userId, now);
    return presentFirstValueRecommendation(recommendation);
  } catch (error) {
    console.error("first-value dashboard load failed", {
      name: error instanceof Error ? error.name : "Error",
    });
    return null;
  }
}
