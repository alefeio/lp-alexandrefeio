import type { ReactNode } from "react";
import { PlatformShell } from "@/components/analytics/PlatformShell";
import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";
import { JsonLd } from "@/components/seo/JsonLd";

export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <PlatformShell>
      <JsonLd />
      <Header />
      <main id="conteudo">{children}</main>
      <Footer />
    </PlatformShell>
  );
}
