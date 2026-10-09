import { ImageResponse } from "next/og";
import { heroContent } from "@/data/home";
import { siteConfig } from "@/data/site-config";

export const alt = `${siteConfig.name} — Tráfego pago e conversão`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
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
        <div style={{ display: "flex", flexDirection: "column", maxWidth: 900 }}>
          <div style={{ display: "flex", fontSize: 22, letterSpacing: 3, color: "#1E5EFF" }}>
            {heroContent.eyebrow.toUpperCase()}
          </div>
          <div style={{ display: "flex", fontSize: 60, lineHeight: 1.12, marginTop: 20 }}>
            {heroContent.title}
          </div>
        </div>
        <div style={{ display: "flex", fontSize: 28, color: "#5B6472" }}>{siteConfig.location.short}</div>
      </div>
    ),
    { ...size },
  );
}
