"use server";

import { revalidatePath } from "next/cache";
import { writeAdminAuditLog } from "@/lib/admin/commerce-audit";
import { applyProviderView } from "@/lib/commerce/apply";
import { fetchProviderPayment } from "@/lib/commerce/provider";
import { requireAdmin } from "@/lib/auth/session";
import { getPrisma } from "@/lib/db/prisma";

export async function setUserTestAccountAction(formData: FormData): Promise<void> {
  const session = await requireAdmin();
  if (!session) return;

  const userId = String(formData.get("userId") ?? "").trim();
  const next = String(formData.get("isTestAccount") ?? "") === "1";
  if (!userId) return;

  const prisma = getPrisma();
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, isTestAccount: true, email: true },
  });
  if (!user) return;
  if (user.isTestAccount === next) return;

  await prisma.user.update({
    where: { id: userId },
    data: { isTestAccount: next, updatedAt: new Date() },
  });

  await writeAdminAuditLog({
    actorUserId: session.user.id,
    action: next ? "test_account_set" : "test_account_clear",
    targetType: "user",
    targetId: userId,
    summary: next
      ? `Conta marcada como teste (classificação administrativa).`
      : `Conta desmarcada como teste (classificação administrativa).`,
  });

  revalidatePath(`/admin/usuarios/${userId}`);
  revalidatePath("/admin/compras");
  revalidatePath("/admin");
}

/** Gate E.1 — somente GET no provedor; sem alterar estado financeiro no banco. */
export async function inspectMercadoPagoPaymentAction(formData: FormData): Promise<void> {
  const session = await requireAdmin();
  if (!session) return;

  const paymentId = String(formData.get("paymentId") ?? "").trim();
  if (!paymentId) return;

  const payment = await getPrisma().payment.findUnique({
    where: { id: paymentId },
    select: {
      id: true,
      orderId: true,
      providerPaymentId: true,
      status: true,
      amountCents: true,
    },
  });
  if (!payment?.providerPaymentId) return;

  const view = await fetchProviderPayment(payment.providerPaymentId);
  await writeAdminAuditLog({
    actorUserId: session.user.id,
    action: "payment_inspect",
    targetType: "payment",
    targetId: payment.id,
    summary: view
      ? `Consulta MP (somente leitura): status=${view.status} detail=${view.statusDetail ?? "—"} amount=${view.amountCents}`
      : "Consulta MP (somente leitura): pagamento não encontrado no provedor.",
  });

  revalidatePath(`/admin/compras/${payment.orderId}`);
}

/**
 * Gate E.2 — consulta + aplicação segura via reconcile existente.
 * Exige confirmação explícita. Nunca força PAID sem validação financeira.
 */
export async function reconcileAdminPaymentAction(formData: FormData): Promise<void> {
  const session = await requireAdmin();
  if (!session) return;

  const paymentId = String(formData.get("paymentId") ?? "").trim();
  const confirm = String(formData.get("confirm") ?? "") === "1";
  if (!confirm || !paymentId) return;

  const payment = await getPrisma().payment.findUnique({
    where: { id: paymentId },
    select: {
      id: true,
      orderId: true,
      providerPaymentId: true,
      status: true,
      amountCents: true,
    },
  });
  if (!payment?.providerPaymentId) return;

  const view = await fetchProviderPayment(payment.providerPaymentId);
  if (!view) {
    await writeAdminAuditLog({
      actorUserId: session.user.id,
      action: "payment_reconcile",
      targetType: "payment",
      targetId: payment.id,
      summary: "Reconciliação abortada: provedor não retornou o pagamento.",
    });
    revalidatePath(`/admin/compras/${payment.orderId}`);
    return;
  }

  if (view.externalReference !== payment.orderId) {
    await writeAdminAuditLog({
      actorUserId: session.user.id,
      action: "payment_reconcile",
      targetType: "payment",
      targetId: payment.id,
      summary: "Reconciliação abortada: external_reference diverge do pedido local.",
    });
    revalidatePath(`/admin/compras/${payment.orderId}`);
    return;
  }

  if (view.currency !== "BRL" || view.amountCents !== payment.amountCents) {
    await writeAdminAuditLog({
      actorUserId: session.user.id,
      action: "payment_reconcile",
      targetType: "payment",
      targetId: payment.id,
      summary: `Reconciliação abortada: moeda/valor divergentes (remoto ${view.currency}/${view.amountCents}).`,
    });
    revalidatePath(`/admin/compras/${payment.orderId}`);
    return;
  }

  await applyProviderView(payment.id, view);

  await writeAdminAuditLog({
    actorUserId: session.user.id,
    action: "payment_reconcile",
    targetType: "payment",
    targetId: payment.id,
    summary: `Reconciliação aplicada: provider=${view.status}/${view.statusDetail ?? "—"} local_antes=${payment.status}`,
  });

  revalidatePath(`/admin/compras/${payment.orderId}`);
  revalidatePath("/admin/compras");
}
