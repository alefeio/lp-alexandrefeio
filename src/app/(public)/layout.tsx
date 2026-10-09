import type { ReactNode } from "react";
import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";
import { JsonLd } from "@/components/seo/JsonLd";

export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <JsonLd />
      <Header />
      <main id="conteudo">{children}</main>
      <Footer />
    </>
  );
}
