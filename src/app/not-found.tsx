import Link from "next/link";
import { PlatformShell } from "@/components/analytics/PlatformShell";
import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";
import { Container } from "@/components/ui/Container";

export const metadata = {
  title: "Página não encontrada",
  robots: { index: false, follow: true },
};

export default function NotFound() {
  return (
    <PlatformShell>
      <Header />
      <main id="conteudo">
        <Container className="py-16 sm:py-20">
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-cta">404</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">Página não encontrada</h1>
          <p className="mt-3 max-w-xl text-base leading-relaxed text-muted">
            Esse endereço não existe. Você pode voltar ao início ou ver as formações.
          </p>
          <p className="mt-6 flex flex-col gap-3 text-sm sm:flex-row sm:gap-6">
            <Link className="underline underline-offset-4" href="/">
              Ir para o início
            </Link>
            <Link className="underline underline-offset-4" href="/cursos">
              Ver as formações
            </Link>
          </p>
        </Container>
      </main>
      <Footer />
    </PlatformShell>
  );
}
