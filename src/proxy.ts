import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

export function needsSession(pathname: string): boolean {
  return pathname === "/app" || pathname.startsWith("/app/") || pathname === "/admin" || pathname.startsWith("/admin/");
}

/** Destino do visitante sem cookie de sessão. Null quando a rota segue. */
export function unauthenticatedEntry(pathname: string, hasSessionCookie: boolean): string | null {
  if (!needsSession(pathname) || hasSessionCookie) return null;
  return `/entrar?next=${encodeURIComponent(pathname)}`;
}

export function proxy(request: NextRequest) {
  if (!needsSession(request.nextUrl.pathname)) return NextResponse.next();

  const sessionCookie = getSessionCookie(request);
  if (sessionCookie) return NextResponse.next();

  const url = request.nextUrl.clone();
  url.pathname = "/entrar";
  url.searchParams.set("next", request.nextUrl.pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/app", "/app/:path*", "/admin", "/admin/:path*"],
};
