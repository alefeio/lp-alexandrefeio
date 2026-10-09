import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth, USER_ROLES } from "@/lib/auth/auth";

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
  if (session.user.role !== USER_ROLES.admin) return null;
  return session;
}
