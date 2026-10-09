import { redirect } from "next/navigation";
import { AuthTextLink, SignUpForm } from "@/components/auth/AuthForms";
import { AuthShell } from "@/components/auth/AuthShell";
import { getSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function SignUpPage() {
  const session = await getSession();
  if (session) redirect("/app");

  return (
    <AuthShell
      title="Criar conta"
      description="Nome, e-mail e senha. A confirmação chega por e-mail."
      footer={
        <p>
          Já tem conta? <AuthTextLink href="/entrar">Entrar</AuthTextLink>
        </p>
      }
    >
      <SignUpForm />
    </AuthShell>
  );
}
