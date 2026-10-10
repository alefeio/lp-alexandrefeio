import type { ReactNode } from "react";
import Link from "next/link";
import { SignOutButton } from "@/components/auth/AuthForms";
import { Container } from "@/components/ui/Container";
import { Wordmark } from "@/components/ui/Wordmark";
import { requireSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function StudentLayout({ children }: { children: ReactNode }) {
  await requireSession();

  return (
    <div className="flex min-h-[100dvh] flex-col">
      <header className="border-b border-border">
        <Container className="flex h-16 items-center justify-between gap-4">
          <Link href="/app" className="text-foreground">
            <Wordmark />
          </Link>
          <nav aria-label="Área do aluno" className="flex items-center gap-4 text-sm">
            <Link href="/app/aprendizado" className="underline underline-offset-4">
              Aprendizado
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
