import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { SignOutButton } from "@/components/auth/AuthForms";
import { Container } from "@/components/ui/Container";
import { Wordmark } from "@/components/ui/Wordmark";
import { requireSession } from "@/lib/auth/session";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function StudentLayout({ children }: { children: ReactNode }) {
  await requireSession();

  return (
    <div className="flex min-h-[100dvh] flex-col">
      <header className="border-b border-border">
        <Container className="flex min-h-16 flex-wrap items-center justify-between gap-x-4 gap-y-2 py-3">
          <Link href="/app" className="text-foreground">
            <Wordmark />
          </Link>
          <nav aria-label="Área do aluno" className="flex flex-wrap items-center justify-end gap-x-4 gap-y-2 text-sm">
            <Link href="/app/aprendizado" className="underline underline-offset-4">
              Aprendizado
            </Link>
            <Link href="/app/projetos" className="underline underline-offset-4">
              Projetos
            </Link>
            <Link href="/app/alertas" className="underline underline-offset-4">
              Alertas
            </Link>
            <SignOutButton />
          </nav>
        </Container>
      </header>
      <main id="conteudo" className="flex-1 py-16">
        {children}
      </main>
    </div>
  );
}
