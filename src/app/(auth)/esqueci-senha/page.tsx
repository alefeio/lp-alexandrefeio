import { AuthTextLink, ForgotPasswordForm } from "@/components/auth/AuthForms";
import { AuthShell } from "@/components/auth/AuthShell";

export const dynamic = "force-dynamic";

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      title="Esqueci minha senha"
      description="Enviaremos um link se este e-mail tiver conta."
      footer={
        <p>
          <AuthTextLink href="/entrar">Voltar para entrar</AuthTextLink>
        </p>
      }
    >
      <ForgotPasswordForm />
    </AuthShell>
  );
}
