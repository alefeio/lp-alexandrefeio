import { AuthShell } from "@/components/auth/AuthShell";
import { AuthTextLink } from "@/components/auth/AuthForms";
import { AUTH_MESSAGES } from "@/lib/auth/messages";

export const dynamic = "force-dynamic";

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ enviado?: string | string[] }>;
}) {
  const params = await searchParams;
  const sent = params.enviado === "1";

  return (
    <AuthShell
      title="Confirme seu e-mail"
      description={sent ? AUTH_MESSAGES.signedUp : "Abra o link enviado para o seu e-mail. Depois, entre com a senha."}
      footer={
        <p>
          <AuthTextLink href="/entrar">Ir para entrar</AuthTextLink>
        </p>
      }
    >
      <p className="text-sm leading-relaxed text-muted">O link expira. Se não chegar, tente entrar para receber outro.</p>
    </AuthShell>
  );
}
