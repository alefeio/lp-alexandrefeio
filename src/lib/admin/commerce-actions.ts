"use server";

import { revalidatePath } from "next/cache";
import {
  inspectMercadoPagoPaymentService,
  reconcileAdminPaymentService,
  setUserTestAccountAtomic,
} from "@/lib/admin/commerce-reconcile";
import { fetchProviderPayment } from "@/lib/commerce/provider";
import { requireAdmin } from "@/lib/auth/session";

export async function setUserTestAccountAction(formData: FormData): Promise<void> {
  const session = await requireAdmin();
  if (!session) return;

  const userId = String(formData.get("userId") ?? "");
  const isTestAccountRaw = String(formData.get("isTestAccount") ?? "");
  const result = await setUserTestAccountAtomic({
    actorUserId: session.user.id,
    userId,
    isTestAccountRaw,
  });
  if (!result.ok || !result.changed) return;

  revalidatePath(`/admin/usuarios/${userId.trim()}`);
  revalidatePath("/admin/compras");
  revalidatePath("/admin");
}

/** Somente GET no provedor; sem alteração financeira. */
export async function inspectMercadoPagoPaymentAction(formData: FormData): Promise<void> {
  const session = await requireAdmin();
  if (!session) return;

  const paymentId = String(formData.get("paymentId") ?? "").trim();
  if (!paymentId) return;

  const result = await inspectMercadoPagoPaymentService({
    actorUserId: session.user.id,
    paymentId,
    fetchView: fetchProviderPayment,
  });
  if (result.orderId) revalidatePath(`/admin/compras/${result.orderId}`);
}

/**
 * Consulta + aplicação segura. Exige confirmação.
 * Nunca força PAID sem validação; não cria cobrança; não usa Payments API (#33).
 */
export async function reconcileAdminPaymentAction(formData: FormData): Promise<void> {
  const session = await requireAdmin();
  if (!session) return;

  const paymentId = String(formData.get("paymentId") ?? "").trim();
  const confirm = String(formData.get("confirm") ?? "") === "1";
  if (!paymentId) return;

  const result = await reconcileAdminPaymentService({
    actorUserId: session.user.id,
    paymentId,
    confirmed: confirm,
    fetchView: fetchProviderPayment,
  });

  if (result.orderId) {
    revalidatePath(`/admin/compras/${result.orderId}`);
    revalidatePath("/admin/compras");
  }
}
