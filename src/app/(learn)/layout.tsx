import type { ReactNode } from "react";
import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { Wordmark } from "@/components/ui/Wordmark";

export default function LearnLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-[100dvh] flex-col">
      <header className="border-b border-border">
        <Container className="flex h-16 items-center justify-between gap-4">
          <Link href="/" className="text-foreground">
            <Wordmark />
          </Link>
          <nav aria-label="Aula" className="flex items-center gap-4 text-sm">
            <Link href="/cursos" className="underline underline-offset-4">
              Cursos
            </Link>
            <Link href="/app" className="underline underline-offset-4">
              Área do aluno
            </Link>
          </nav>
        </Container>
      </header>
      <main id="conteudo" className="flex-1">
        {children}
      </main>
    </div>
  );
}
