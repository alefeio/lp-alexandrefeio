import { redirect } from "next/navigation";
import { AuthTextLink, SignInForm } from "@/components/auth/AuthForms";
import { AuthShell } from "@/components/auth/AuthShell";
import { AUTH_MESSAGES, safeNextPath } from "@/lib/auth/messages";
import { getSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[]; redefinida?: string | string[] }>;
}) {
  const session = await getSession();
  const params = await searchParams;
  const nextPath = safeNextPath(typeof params.next === "string" ? params.next : undefined);
  if (session) redirect(nextPath);

  return (
    <AuthShell
      title="Entrar"
      description="Acesse com o e-mail e a senha da sua conta."
      footer={
        <p>
          Não tem conta? <AuthTextLink href="/cadastro">Criar conta</AuthTextLink>
          <span className="mx-2">·</span>
          <AuthTextLink href="/esqueci-senha">Esqueci minha senha</AuthTextLink>
        </p>
      }
    >
      {params.redefinida ? <p className="mb-4 text-sm text-muted">{AUTH_MESSAGES.resetDone}</p> : null}
      <SignInForm nextPath={nextPath} />
    </AuthShell>
  );
}
