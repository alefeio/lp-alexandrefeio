"use client";

import { useEffect, type ComponentProps } from "react";
import { useRouter } from "next/navigation";
import { initMercadoPago, Payment } from "@mercadopago/sdk-react";
import { payOrderAction } from "@/lib/commerce/actions";
import { reaisFromCents } from "@/lib/commerce/analytics";

export function PaymentBrick({
  publicKey,
  orderId,
  amountCents,
  payerEmail,
}: {
  publicKey: string;
  orderId: string;
  amountCents: number;
  payerEmail: string;
}) {
  const router = useRouter();
  useEffect(() => {
    initMercadoPago(publicKey, { locale: "pt-BR" });
  }, [publicKey]);

  return (
    <Payment
      initialization={{ amount: reaisFromCents(amountCents), payer: { email: payerEmail } }}
      customization={{
        paymentMethods: {
          creditCard: "all",
          bankTransfer: "all",
          maxInstallments: 3,
        } as ComponentProps<typeof Payment>["customization"]["paymentMethods"],
      }}
      onSubmit={async ({ formData }) => {
        const data = formData as {
          payment_method_id?: string;
          token?: string;
          issuer_id?: string | number;
          installments?: number;
          payer?: { email?: string; identification?: { type?: string; number?: string } };
        };
        const result = await payOrderAction(orderId, {
          paymentMethodId: data.payment_method_id ?? "",
          token: data.token,
          issuerId: data.issuer_id == null ? undefined : String(data.issuer_id),
          installments: data.installments,
          payerEmail: data.payer?.email || payerEmail,
          identificationType: data.payer?.identification?.type,
          identificationNumber: data.payer?.identification?.number,
        });
        if (!result.ok) throw new Error(result.message);
        router.push(`/app/compras/${orderId}`);
      }}
    />
  );
}
