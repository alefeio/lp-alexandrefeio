import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import { requireSession } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Área do aluno",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function StudentHomePage() {
  const session = await requireSession();

  return (
    <Container className="max-w-2xl">
      <p className="text-xs font-medium uppercase tracking-[0.16em] text-cta">Conta</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight">Área do aluno</h1>
      <p className="mt-4 text-base leading-relaxed text-muted">Você está autenticado. Ainda não há cursos nesta área.</p>
      <dl className="mt-8 space-y-3 text-sm">
        <div>
          <dt className="text-muted">Nome</dt>
          <dd className="font-medium">{session.user.name}</dd>
        </div>
        <div>
          <dt className="text-muted">E-mail</dt>
          <dd className="font-medium">{session.user.email}</dd>
        </div>
      </dl>
    </Container>
  );
}
