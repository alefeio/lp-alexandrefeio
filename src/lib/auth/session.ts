import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/auth";
import { isAdminRole } from "@/lib/auth/policy";

export async function getSession() {
  return auth.api.getSession({
    headers: await headers(),
  });
}

export async function requireSession() {
  const session = await getSession();
  if (!session) redirect("/entrar");
  return session;
}

export async function requireAdmin() {
  const session = await requireSession();
  if (!isAdminRole(session.user.role)) return null;
  return session;
}
