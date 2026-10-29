import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { PlatformShell } from "@/components/analytics/PlatformShell";
import { StudentNav } from "@/components/app/StudentNav";
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
    <PlatformShell>
    <div className="flex min-h-[100dvh] flex-col">
      <header className="border-b border-border">
        <Container className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between">
          <Link href="/app" className="shrink-0 text-foreground">
            <Wordmark />
          </Link>
          <StudentNav />
        </Container>
      </header>
      <main id="conteudo" className="flex-1 py-16">
        {children}
      </main>
    </div>
    </PlatformShell>
  );
}
