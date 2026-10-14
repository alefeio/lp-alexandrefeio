import Link from "next/link";
import { AuthTextLink, ResendVerificationForm } from "@/components/auth/AuthForms";
import { AuthShell } from "@/components/auth/AuthShell";
import { authNextHref, safeNextPath, verificationCallbackPath, verificationView } from "@/lib/auth/messages";
import { getSession } from "@/lib/auth/session";
import { buttonClass } from "@/lib/button-styles";

export const dynamic = "force-dynamic";

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ enviado?: string | string[]; confirmado?: string | string[]; next?: string | string[]; error?: string | string[] }>;
}) {
  const params = await searchParams;
  const nextRaw = typeof params.next === "string" ? params.next : undefined;
  const view = verificationView({
    confirmado: typeof params.confirmado === "string" ? params.confirmado : undefined,
    error: typeof params.error === "string" ? params.error : undefined,
  });
  const destination = safeNextPath(nextRaw);
  const session = view === "confirmed" ? await getSession() : null;
  const continueHref = session ? destination : authNextHref("/entrar", nextRaw);

  if (view === "confirmed") {
    return (
      <AuthShell title="E-mail confirmado" description="Sua conta está pronta.">
        <Link className={buttonClass("primary")} href={continueHref}>
          {session ? "Continuar" : "Entrar e continuar"}
        </Link>
      </AuthShell>
    );
  }

  if (view === "invalid") {
    return (
      <AuthShell title="Este link não é mais válido." description="Peça outro link para confirmar a conta.">
        <ResendVerificationForm callbackURL={verificationCallbackPath(nextRaw)} />
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Confira seu e-mail"
      description="Enviamos um link para confirmar sua conta."
      footer={
        <p>
          <AuthTextLink href={authNextHref("/entrar", nextRaw)}>Ir para entrar</AuthTextLink>
        </p>
      }
    >
      <p className="text-sm leading-relaxed text-muted">O link expira por segurança. Depois de confirmar, entre com a senha.</p>
    </AuthShell>
  );
}
