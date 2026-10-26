import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { PlatformShell } from "@/components/analytics/PlatformShell";
import { SignOutButton } from "@/components/auth/AuthForms";
import { Container } from "@/components/ui/Container";
import { Wordmark } from "@/components/ui/Wordmark";
import { requireAdmin } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Administração",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const session = await requireAdmin();

  if (!session) {
    return (
      <PlatformShell>
      <main id="conteudo" className="py-24">
        <Container className="max-w-xl">
          <h1 className="text-3xl font-semibold tracking-tight">Sem acesso</h1>
          <p className="mt-4 text-base leading-relaxed text-muted">Esta área é só para administração.</p>
          <p className="mt-6">
            <Link href="/app" className="text-sm underline underline-offset-4">
              Voltar à área do aluno
            </Link>
          </p>
        </Container>
      </main>
      </PlatformShell>
    );
  }

  return (
    <PlatformShell>
    <div className="flex min-h-[100dvh] flex-col">
      <header className="border-b border-border">
        <Container className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 py-3">
          <Link href="/admin" className="text-foreground" aria-label="Visão geral — Alexandre Feio">
            <Wordmark />
          </Link>
          <nav className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
            <Link href="/admin">Visão geral</Link>
            <Link href="/admin/jornada">Jornada</Link>
            <Link href="/admin/usuarios">Usuários</Link>
            <Link href="/admin/compras">Compras</Link>
            <Link href="/admin/cursos">Cursos</Link>
            <SignOutButton />
          </nav>
        </Container>
      </header>
      <main id="conteudo" className="flex-1 py-8 sm:py-10">
        {children}
      </main>
    </div>
    </PlatformShell>
  );
}
