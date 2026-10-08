import type { Metadata } from "next";
import { ObrigadoContent } from "@/app/obrigado/ObrigadoContent";
import { Container } from "@/components/ui/Container";

export const metadata: Metadata = {
  title: "Contato recebido",
  description: "Confirmação de envio do formulário de contato.",
  robots: {
    index: false,
    follow: false,
  },
  alternates: {
    canonical: "/obrigado",
  },
  openGraph: {
    url: "/obrigado",
    title: "Contato recebido",
    description: "Confirmação de envio do formulário de contato.",
  },
};

export default function ThankYouPage() {
  return (
    <section className="py-16 sm:py-24">
      <Container>
        <div className="mx-auto max-w-2xl">
          <ObrigadoContent />
        </div>
      </Container>
    </section>
  );
}
