import type { ReactNode } from "react";
import Link from "next/link";
import { PlatformShell } from "@/components/analytics/PlatformShell";
import { AccountNav } from "@/components/layout/AccountNav";
import { Container } from "@/components/ui/Container";
import { Wordmark } from "@/components/ui/Wordmark";
import { getSession } from "@/lib/auth/session";

export default async function LearnLayout({ children }: { children: ReactNode }) {
  const session = await getSession();
  return (
    <PlatformShell>
    <div className="flex min-h-[100dvh] flex-col">
      <header className="border-b border-border">
        <Container className="flex min-h-16 flex-wrap items-center justify-between gap-x-4 gap-y-2 py-3">
          <Link href="/" className="text-foreground">
            <Wordmark />
          </Link>
          <nav aria-label="Aula" className="flex flex-wrap items-center justify-end gap-x-4 gap-y-2 text-sm">
            <Link href="/cursos" className="underline underline-offset-4">
              Cursos
            </Link>
            <AccountNav signedIn={Boolean(session)} source="public_header" />
          </nav>
        </Container>
      </header>
      <main id="conteudo" className="flex-1">
        {children}
      </main>
    </div>
    </PlatformShell>
  );
}
