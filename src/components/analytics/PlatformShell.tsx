import type { ReactNode } from "react";
import { AttributionCapture } from "@/components/analytics/AttributionCapture";
import { GoogleTagManager } from "@/components/analytics/GoogleTagManager";
import { ConsentProvider } from "@/components/consent/ConsentProvider";

const gtmId = process.env.NEXT_PUBLIC_GTM_ID?.trim();

/** Chrome e medição da plataforma. A landing pública em /p não usa este invólucro. */
export function PlatformShell({ children }: { children: ReactNode }) {
  return (
    <>
      {gtmId ? <GoogleTagManager gtmId={gtmId} /> : null}
      <ConsentProvider>
        <AttributionCapture />
        <a href="#conteudo" className="skip-link">
          Ir para o conteúdo
        </a>
        {children}
      </ConsentProvider>
    </>
  );
}
