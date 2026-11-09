"use server";

import { updateProductPrice, type PricingTarget } from "@/lib/admin/pricing";
import { requireAdmin } from "@/lib/auth/session";

export async function updateProductPriceAction(form: FormData) {
  const session = await requireAdmin();
  if (!session) return { ok: false as const, message: "Sem acesso." };

  const target = String(form.get("target") ?? "") as PricingTarget;
  if (target !== "lesson" && target !== "module" && target !== "course") {
    return { ok: false as const, message: "Alvo de preço inválido." };
  }

  return updateProductPrice(
    { userId: session.user.id, role: session.user.role ?? "" },
    {
      target,
      id: String(form.get("id") ?? ""),
      amountBrl: String(form.get("amountBrl") ?? ""),
      expectedUpdatedAt: String(form.get("updatedAt") ?? ""),
      confirmAvailable: String(form.get("confirmAvailable") ?? "") === "1",
    },
  );
}
