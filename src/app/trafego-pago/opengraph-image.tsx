import { ImageResponse } from "next/og";
import { siteConfig } from "@/data/site-config";

export const alt = "Gestão de Tráfego Pago — Alexandre Feio";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function TrafegoPagoOpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#F8FAFC",
          color: "#0F172A",
          padding: "72px",
        }}
      >
        <div style={{ display: "flex", fontSize: 28 }}>{siteConfig.name}</div>
        <div style={{ display: "flex", flexDirection: "column", maxWidth: 980 }}>
          <div style={{ display: "flex", fontSize: 22, letterSpacing: 3, color: "#1E5EFF" }}>
            GOOGLE ADS + ESTRATÉGIA + CONVERSÃO
          </div>
          <div style={{ display: "flex", fontSize: 58, lineHeight: 1.12, marginTop: 20 }}>
            Gestão de Tráfego Pago para gerar oportunidades reais.
          </div>
        </div>
        <div style={{ display: "flex", fontSize: 28, color: "#5B6472" }}>{siteConfig.location.short}</div>
      </div>
    ),
    { ...size },
  );
}
