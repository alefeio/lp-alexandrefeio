"use client";

import { useState } from "react";
import { buttonClass } from "@/lib/button-styles";

export function PixPaymentPanel({
  copy,
  image,
  missing,
}: {
  copy?: string | null;
  image?: string | null;
  missing?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  if (missing) {
    return (
      <div className="mt-6 rounded-lg border border-border bg-surface px-4 py-3" role="alert">
        <p className="text-sm">
          O Pix foi iniciado, mas o QR Code ainda não está disponível. Atualize o status em alguns segundos. Não gere outra cobrança.
        </p>
      </div>
    );
  }

  if (!copy || !image) return null;

  async function copyPix() {
    try {
      await navigator.clipboard.writeText(copy!);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="mt-6">
      <p className="text-sm" role="status">
        Pix pendente. O acesso só é liberado depois da confirmação do pagamento.
      </p>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="mt-3 h-48 w-48" alt="QR Code do Pix" src={`data:image/png;base64,${image}`} />
      <p className="mt-3 break-all text-sm" aria-label="Pix Copia e Cola">
        {copy}
      </p>
      <button className={`${buttonClass("secondary")} mt-3`} type="button" onClick={() => void copyPix()}>
        {copied ? "Copiado" : "Copiar Pix Copia e Cola"}
      </button>
    </div>
  );
}
