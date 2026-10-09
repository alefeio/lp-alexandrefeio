import { ResetPasswordForm } from "@/components/auth/AuthForms";
import { AuthShell } from "@/components/auth/AuthShell";
import { AUTH_MESSAGES } from "@/lib/auth/messages";

export const dynamic = "force-dynamic";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  const params = await searchParams;
  const token = typeof params.token === "string" ? params.token : "";

  return (
    <AuthShell title="Nova senha" description="Escolha uma senha com pelo menos 8 caracteres.">
      {token ? <ResetPasswordForm token={token} /> : <p className="text-sm text-muted">{AUTH_MESSAGES.invalidToken}</p>}
    </AuthShell>
  );
}
