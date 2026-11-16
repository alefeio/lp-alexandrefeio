"use client";

import { useEffect, useRef, useState, type ComponentProps } from "react";
import { useRouter } from "next/navigation";
import { initMercadoPago, Payment } from "@mercadopago/sdk-react";
import { payOrderAction } from "@/lib/commerce/actions";
import { reaisFromCents } from "@/lib/commerce/analytics";
import { buttonClass } from "@/lib/button-styles";

function safeClientMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) {
    const message = error.message.trim();
    if (/token|secret|Bearer|APP_USR|access_token/i.test(message)) return fallback;
    return message.slice(0, 180);
  }
  return fallback;
}

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
  const submittingRef = useRef(false);
  const [ready, setReady] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [brickKey, setBrickKey] = useState(0);

  useEffect(() => {
    initMercadoPago(publicKey, { locale: "pt-BR" });
  }, [publicKey]);

  function retryBrick() {
    submittingRef.current = false;
    setProcessing(false);
    setError(null);
    setReady(false);
    setBrickKey((value) => value + 1);
  }

  return (
    <div aria-busy={processing || !ready}>
      {!ready && !error ? (
        <p className="mb-3 text-sm text-muted" role="status">
          Carregando o formulário de pagamento…
        </p>
      ) : null}
      {processing ? (
        <p className="mb-3 text-sm text-muted" role="status">
          Processando o pagamento. Aguarde um momento…
        </p>
      ) : null}
      {error ? (
        <div className="mb-4 rounded-lg border border-border bg-surface px-4 py-3" role="alert">
          <p className="text-sm">{error}</p>
          <button className={`${buttonClass("secondary")} mt-3`} type="button" onClick={retryBrick} disabled={processing}>
            Tentar novamente
          </button>
        </div>
      ) : null}
      <div className={processing ? "pointer-events-none opacity-60" : undefined} aria-disabled={processing}>
        <Payment
          key={brickKey}
          initialization={{ amount: reaisFromCents(amountCents), payer: { email: payerEmail } }}
          customization={{
            paymentMethods: {
              creditCard: "all",
              bankTransfer: "all",
              maxInstallments: 3,
            } as ComponentProps<typeof Payment>["customization"]["paymentMethods"],
          }}
          onReady={() => {
            setReady(true);
          }}
          onError={(brickError) => {
            if (brickError.type === "non_critical") return;
            setError(
              safeClientMessage(
                new Error(brickError.message || "Não foi possível carregar o pagamento."),
                "Não foi possível carregar o formulário de pagamento. Tente novamente.",
              ),
            );
          }}
          onSubmit={async ({ formData }) => {
            if (submittingRef.current || processing) {
              throw new Error("O pagamento já está em andamento.");
            }
            submittingRef.current = true;
            setProcessing(true);
            setError(null);
            try {
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
              if (!result.ok) {
                const message = result.message || "Não foi possível concluir o pagamento.";
                setError(message);
                throw new Error(message);
              }
              router.push(`/app/compras/${orderId}`);
              return;
            } catch (caught) {
              const message = safeClientMessage(caught, "Não foi possível concluir o pagamento. Tente novamente.");
              setError(message);
              throw caught instanceof Error ? caught : new Error(message);
            } finally {
              submittingRef.current = false;
              setProcessing(false);
            }
          }}
        />
      </div>
    </div>
  );
}
