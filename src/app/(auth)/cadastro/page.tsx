import { redirect } from "next/navigation";
import { AuthTextLink, SignUpForm } from "@/components/auth/AuthForms";
import { AuthShell } from "@/components/auth/AuthShell";
import { safeNextPath } from "@/lib/auth/messages";
import { getSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const session = await getSession();
  const params = await searchParams;
  const rawNext = typeof params.next === "string" ? params.next : undefined;
  const nextPath = safeNextPath(rawNext);
  if (session) redirect(rawNext ? nextPath : "/app");
  const loginHref = rawNext ? `/entrar?next=${encodeURIComponent(nextPath)}` : "/entrar";

  return (
    <AuthShell
      title="Criar conta"
      description="Nome, e-mail e senha. A confirmação chega por e-mail."
      footer={
        <p>
          Já tem conta? <AuthTextLink href={loginHref}>Entrar</AuthTextLink>
        </p>
      }
    >
      <SignUpForm />
    </AuthShell>
  );
}
