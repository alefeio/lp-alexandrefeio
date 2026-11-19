"use client";

import { useState } from "react";
import { buttonClass, navigationLinkClass } from "@/lib/button-styles";

export function PixPaymentPanel({
  copy,
  image,
  ticketUrl,
  missing,
}: {
  copy?: string | null;
  image?: string | null;
  ticketUrl?: string | null;
  missing?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const hasCopy = Boolean(copy?.trim());
  const hasImage = Boolean(image?.trim());
  const hasTicket = Boolean(ticketUrl?.trim());

  if (missing || (!hasCopy && !hasImage && !hasTicket)) {
    return (
      <div className="mt-6 rounded-lg border border-border bg-surface px-4 py-3" role="alert">
        <p className="text-sm">
          O Pix foi iniciado, mas o QR Code ainda não está disponível. Atualize o status em alguns segundos. Não gere outra cobrança.
        </p>
      </div>
    );
  }

  async function copyPix() {
    if (!copy) return;
    try {
      await navigator.clipboard.writeText(copy);
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
      {hasImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="mt-3 h-48 w-48" alt="QR Code do Pix" src={`data:image/png;base64,${image}`} />
      ) : null}
      {hasCopy ? (
        <p className="mt-3 break-all text-sm" aria-label="Pix Copia e Cola">
          {copy}
        </p>
      ) : null}
      <div className="mt-3 flex flex-col items-start gap-2">
        {hasCopy ? (
          <button className={buttonClass("secondary")} type="button" onClick={() => void copyPix()}>
            {copied ? "Copiado" : "Copiar Pix Copia e Cola"}
          </button>
        ) : null}
        {hasTicket ? (
          <a className={navigationLinkClass()} href={ticketUrl!} target="_blank" rel="noopener noreferrer">
            Abrir página oficial do Pix
          </a>
        ) : null}
        {!hasImage && (hasCopy || hasTicket) ? (
          <p className="text-xs text-muted">O QR Code em imagem ainda não veio do provedor. Use o Copia e Cola ou o link oficial.</p>
        ) : null}
      </div>
    </div>
  );
}
