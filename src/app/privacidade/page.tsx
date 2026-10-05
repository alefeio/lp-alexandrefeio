import type { Metadata } from "next";
import Link from "next/link";
import { siteConfig } from "@/data/site-config";
import { Container } from "@/components/ui/Container";

export const metadata: Metadata = {
  title: "Privacidade",
  description: "Como o formulário de contato de Alexandre Feio usa os dados enviados.",
  alternates: { canonical: "/privacidade" },
};

export default function PrivacyPage() {
  const host = new URL(siteConfig.url).host;

  return (
    <article className="py-16 sm:py-24">
      <Container>
        <div className="max-w-2xl">
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-cta">Privacidade</p>
          <h1 className="mt-3 text-[1.85rem] font-semibold leading-[1.15] tracking-tight sm:text-4xl">Como o contato é usado</h1>
          <div className="mt-8 space-y-6 text-base leading-relaxed text-muted">
            <p>
              O formulário de {host} envia nome, empresa, WhatsApp, e-mail e o interesse escolhido. Esses dados servem
              para responder ao contato e para enviar a confirmação desta solicitação. Eles não são vendidos.
            </p>
            <p>
              Nesta versão o site não guarda os contatos em um banco de dados. A mensagem passa por um provedor de
              e-mail e chega na caixa de {siteConfig.fullName}. A confirmação segue para o e-mail informado no
              formulário.
            </p>
            <p>
              Dúvidas sobre este uso podem ser enviadas para{" "}
              <a className="text-foreground underline underline-offset-4" href={`mailto:${siteConfig.contact.email}`}>
                {siteConfig.contact.email}
              </a>
              .
            </p>
          </div>
          <p className="mt-10">
            <Link href="/" className="text-sm text-foreground underline underline-offset-4">
              Voltar ao início
            </Link>
          </p>
        </div>
      </Container>
    </article>
  );
}
