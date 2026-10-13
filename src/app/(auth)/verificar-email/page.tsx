import { AuthShell } from "@/components/auth/AuthShell";
import { AuthTextLink } from "@/components/auth/AuthForms";
import { AUTH_MESSAGES, safeNextPath } from "@/lib/auth/messages";

export const dynamic = "force-dynamic";

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ enviado?: string | string[]; next?: string | string[] }>;
}) {
  const params = await searchParams;
  const sent = params.enviado === "1";
  const nextPath = safeNextPath(typeof params.next === "string" ? params.next : undefined);
  const loginHref = typeof params.next === "string" ? `/entrar?next=${encodeURIComponent(nextPath)}` : "/entrar";

  return (
    <AuthShell
      title="Confirme seu e-mail"
      description={sent ? AUTH_MESSAGES.signedUp : "Abra o link enviado para o seu e-mail. Depois, entre com a senha."}
      footer={
        <p>
          <AuthTextLink href={loginHref}>Ir para entrar</AuthTextLink>
        </p>
      }
    >
      <p className="text-sm leading-relaxed text-muted">O link expira. Se não chegar, tente entrar para receber outro.</p>
    </AuthShell>
  );
}
