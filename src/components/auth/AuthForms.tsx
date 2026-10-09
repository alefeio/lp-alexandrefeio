"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth/auth-client";
import { AUTH_MESSAGES, mapAuthError, safeNextPath } from "@/lib/auth/messages";
import { buttonClass } from "@/lib/button-styles";

const fieldClass =
  "min-h-12 w-full rounded-lg border border-border bg-background px-3 text-base text-foreground focus-visible:border-cta";

function ErrorNote({ message }: { message: string | null }) {
  if (!message) return null;
  return <p className="text-sm text-danger">{message}</p>;
}

export function SignInForm({ nextPath }: { nextPath?: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const destination = safeNextPath(nextPath);

  async function onSubmit(formData: FormData) {
    setError(null);
    const email = String(formData.get("email") ?? "").trim().toLowerCase();
    const password = String(formData.get("password") ?? "");
    if (!email.includes("@") || password.length < 8) {
      setError(AUTH_MESSAGES.credentials);
      return;
    }

    setPending(true);
    const { error: authError } = await authClient.signIn.email({
      email,
      password,
      callbackURL: destination,
    });
    setPending(false);

    if (authError) {
      setError(mapAuthError(authError));
      return;
    }

    router.push(destination);
    router.refresh();
  }

  return (
    <form action={onSubmit} className="space-y-4">
      <ErrorNote message={error} />
      <label className="block text-sm font-medium" htmlFor="email">
        E-mail
        <input id="email" name="email" type="email" autoComplete="email" required className={`${fieldClass} mt-2`} />
      </label>
      <label className="block text-sm font-medium" htmlFor="password">
        Senha
        <input id="password" name="password" type="password" autoComplete="current-password" required minLength={8} className={`${fieldClass} mt-2`} />
      </label>
      <button type="submit" disabled={pending} className={buttonClass("primary", "w-full")}>
        {pending ? "Entrando..." : "Entrar"}
      </button>
    </form>
  );
}

export function SignUpForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(formData: FormData) {
    setError(null);
    const name = String(formData.get("name") ?? "").trim();
    const email = String(formData.get("email") ?? "").trim().toLowerCase();
    const password = String(formData.get("password") ?? "");
    if (name.length < 2 || !email.includes("@") || password.length < 8) {
      setError("Use um nome, um e-mail válido e uma senha com pelo menos 8 caracteres.");
      return;
    }

    setPending(true);
    const { error: authError } = await authClient.signUp.email({
      name,
      email,
      password,
      callbackURL: "/verificar-email",
    });
    setPending(false);

    if (authError) {
      setError(mapAuthError(authError));
      return;
    }

    router.push("/verificar-email?enviado=1");
  }

  return (
    <form action={onSubmit} className="space-y-4">
      <ErrorNote message={error} />
      <label className="block text-sm font-medium" htmlFor="name">
        Nome
        <input id="name" name="name" autoComplete="name" required className={`${fieldClass} mt-2`} />
      </label>
      <label className="block text-sm font-medium" htmlFor="email">
        E-mail
        <input id="email" name="email" type="email" autoComplete="email" required className={`${fieldClass} mt-2`} />
      </label>
      <label className="block text-sm font-medium" htmlFor="password">
        Senha
        <input id="password" name="password" type="password" autoComplete="new-password" required minLength={8} className={`${fieldClass} mt-2`} />
      </label>
      <button type="submit" disabled={pending} className={buttonClass("primary", "w-full")}>
        {pending ? "Criando..." : "Criar conta"}
      </button>
    </form>
  );
}

export function ForgotPasswordForm() {
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, setPending] = useState(false);

  async function onSubmit(formData: FormData) {
    setError(null);
    const email = String(formData.get("email") ?? "").trim().toLowerCase();
    if (!email.includes("@")) {
      setError(AUTH_MESSAGES.generic);
      return;
    }

    setPending(true);
    const { error: authError } = await authClient.requestPasswordReset({
      email,
      redirectTo: "/redefinir-senha",
    });
    setPending(false);

    if (authError) {
      setError(mapAuthError(authError));
      return;
    }

    setDone(true);
  }

  if (done) return <p className="text-sm leading-relaxed text-muted">{AUTH_MESSAGES.resetRequested}</p>;

  return (
    <form action={onSubmit} className="space-y-4">
      <ErrorNote message={error} />
      <label className="block text-sm font-medium" htmlFor="email">
        E-mail
        <input id="email" name="email" type="email" autoComplete="email" required className={`${fieldClass} mt-2`} />
      </label>
      <button type="submit" disabled={pending} className={buttonClass("primary", "w-full")}>
        {pending ? "Enviando..." : "Enviar link"}
      </button>
    </form>
  );
}

export function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(formData: FormData) {
    setError(null);
    const password = String(formData.get("password") ?? "");
    if (password.length < 8) {
      setError("A senha precisa ter pelo menos 8 caracteres.");
      return;
    }

    setPending(true);
    const { error: authError } = await authClient.resetPassword({ newPassword: password, token });
    setPending(false);

    if (authError) {
      setError(mapAuthError(authError));
      return;
    }

    router.push("/entrar?redefinida=1");
  }

  return (
    <form action={onSubmit} className="space-y-4">
      <ErrorNote message={error} />
      <label className="block text-sm font-medium" htmlFor="password">
        Nova senha
        <input id="password" name="password" type="password" autoComplete="new-password" required minLength={8} className={`${fieldClass} mt-2`} />
      </label>
      <button type="submit" disabled={pending} className={buttonClass("primary", "w-full")}>
        {pending ? "Salvando..." : "Salvar senha"}
      </button>
    </form>
  );
}

export function SignOutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  return (
    <button
      type="button"
      disabled={pending}
      className="text-sm text-muted underline-offset-4 hover:text-foreground hover:underline"
      onClick={async () => {
        setPending(true);
        await authClient.signOut();
        router.push("/");
        router.refresh();
      }}
    >
      Sair
    </button>
  );
}

export function AuthTextLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="text-foreground underline underline-offset-4">
      {children}
    </Link>
  );
}
