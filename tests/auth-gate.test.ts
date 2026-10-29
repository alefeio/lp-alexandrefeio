import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { AUTH_MESSAGES, mapAuthError } from "../src/lib/auth/messages";
import {
  accountLookupFeedback,
  isAdminRole,
  RESET_TOKEN_EXPIRES_IN_SECONDS,
  roleForNewUser,
  secureSessionCookies,
  SESSION_COOKIE_ATTRIBUTES,
  SESSION_EXPIRES_IN_SECONDS,
  USER_ROLES,
} from "../src/lib/auth/policy";
import { canReadLessonBody, visibleBlocks } from "../src/lib/learning/access";
import { needsSession, unauthenticatedEntry } from "../src/proxy";

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

function read(relative: string): string {
  return readFileSync(path.join(process.cwd(), relative), "utf8");
}

function exportedBodies(source: string): Array<{ name: string; body: string }> {
  const marks = [...source.matchAll(/export async function (\w+)/g)];
  return marks.map((mark, index) => {
    const start = mark.index ?? 0;
    const end = index + 1 < marks.length ? (marks[index + 1].index ?? source.length) : source.length;
    return { name: mark[1] ?? "", body: source.slice(start, end) };
  });
}

test("visitante sem sessão é barrado em /app e /admin", () => {
  assert.equal(needsSession("/app"), true);
  assert.equal(needsSession("/app/carrinho"), true);
  assert.equal(needsSession("/admin"), true);
  assert.equal(needsSession("/admin/usuarios"), true);
  assert.equal(needsSession("/aulas/aula-gratuita"), false);
  assert.equal(needsSession("/cursos/trafego"), false);
  assert.equal(unauthenticatedEntry("/app", false), "/entrar?next=%2Fapp");
  assert.equal(unauthenticatedEntry("/admin", false), "/entrar?next=%2Fadmin");
  assert.equal(unauthenticatedEntry("/admin/blog", false), "/entrar?next=%2Fadmin%2Fblog");
  assert.equal(unauthenticatedEntry("/app", true), null);
  assert.equal(unauthenticatedEntry("/", false), null);
});

test("páginas privadas e administrativas revalidam a sessão no servidor", () => {
  const appPages = walk(path.join("src", "app", "(app)")).filter((file) => file.endsWith(`${path.sep}page.tsx`));
  const adminPages = walk(path.join("src", "app", "(admin)")).filter((file) => file.endsWith(`${path.sep}page.tsx`));
  assert.ok(appPages.length >= 16);
  assert.ok(adminPages.length >= 16);
  for (const file of appPages) {
    assert.match(readFileSync(file, "utf8"), /requireSession\(/);
  }
  for (const file of adminPages) {
    const source = readFileSync(file, "utf8");
    assert.match(source, /requireAdmin\(\)[\s\S]{0,400}if \(!session\) return null/);
  }
  assert.match(read("src/app/(app)/app/layout.tsx"), /requireSession\(/);
  assert.match(read("src/app/(admin)/admin/layout.tsx"), /requireAdmin\(/);
  assert.match(read("src/app/(admin)/admin/layout.tsx"), /Sem acesso/);
  assert.match(read("src/lib/auth/session.ts"), /auth\.api\.getSession/);
  assert.match(read("src/proxy.ts"), /getSessionCookie/);
});

test("usuário comum não é administrador e o cadastro ignora role do cliente", () => {
  assert.equal(isAdminRole(USER_ROLES.user), false);
  assert.equal(isAdminRole("admin"), false);
  assert.equal(isAdminRole(null), false);
  assert.equal(isAdminRole(USER_ROLES.admin), true);
  assert.equal(roleForNewUser("ADMIN"), USER_ROLES.user);
  assert.equal(roleForNewUser({ role: "ADMIN" }), USER_ROLES.user);
  const auth = read("src/lib/auth/auth.ts");
  assert.match(auth, /input:\s*false/);
  assert.match(auth, /roleForNewUser\(user\.role\)/);
  assert.doesNotMatch(read("src/components/auth/AuthForms.tsx"), /name="role"|role:\s*"ADMIN"/);
});

test("login e recuperação não revelam se o e-mail existe", () => {
  const invalidEmail = mapAuthError({ message: "Invalid email or password", code: "INVALID_EMAIL_OR_PASSWORD" });
  const invalidPassword = mapAuthError({ message: "Invalid password" });
  assert.equal(invalidEmail, AUTH_MESSAGES.credentials);
  assert.equal(invalidPassword, AUTH_MESSAGES.credentials);
  assert.equal(accountLookupFeedback(null), null);
  assert.equal(accountLookupFeedback({ message: "User not found", code: "USER_NOT_FOUND" }), null);
  assert.equal(accountLookupFeedback({ code: "EMAIL_NOT_CONFIGURED" }), null);
  assert.equal(accountLookupFeedback({ message: "EMAIL_SEND_FAILED" }), null);
  assert.equal(accountLookupFeedback({ status: 429, message: "Too many requests" }), AUTH_MESSAGES.rateLimited);
  assert.match(read("src/components/auth/AuthForms.tsx"), /accountLookupFeedback/);
  assert.match(read("src/lib/auth/auth.ts"), /deliverAuthEmail/);
});

test("token de recuperação inválido, expirado ou reutilizado recebe a mesma recusa", () => {
  const invalid = mapAuthError({ code: "INVALID_TOKEN", message: "invalid token" });
  const expired = mapAuthError({ message: "token expired" });
  const reused = mapAuthError({ code: "INVALID_TOKEN", message: "verification not found" });
  assert.equal(invalid, AUTH_MESSAGES.invalidToken);
  assert.equal(expired, AUTH_MESSAGES.invalidToken);
  assert.equal(reused, invalid);
  const auth = read("src/lib/auth/auth.ts");
  assert.match(auth, /resetPasswordTokenExpiresIn:\s*RESET_TOKEN_EXPIRES_IN_SECONDS/);
  assert.match(auth, /revokeSessionsOnPasswordReset:\s*true/);
  assert.equal(RESET_TOKEN_EXPIRES_IN_SECONDS, 60 * 60);
});

test("cookie de sessão fica HttpOnly, SameSite lax e Secure só em HTTPS", () => {
  assert.equal(SESSION_COOKIE_ATTRIBUTES.httpOnly, true);
  assert.equal(SESSION_COOKIE_ATTRIBUTES.sameSite, "lax");
  assert.equal(secureSessionCookies("https://www.alexandrefeio.com.br"), true);
  assert.equal(secureSessionCookies("http://localhost:3000"), false);
  assert.equal(SESSION_EXPIRES_IN_SECONDS, 7 * 24 * 60 * 60);
  const auth = read("src/lib/auth/auth.ts");
  assert.match(auth, /useSecureCookies:\s*secureSessionCookies/);
  assert.match(auth, /defaultCookieAttributes:\s*SESSION_COOKIE_ATTRIBUTES/);
  assert.match(auth, /expiresIn:\s*SESSION_EXPIRES_IN_SECONDS/);
  assert.match(read("src/components/auth/AuthForms.tsx"), /authClient\.signOut\(/);
});

test("conteúdo pago exige entitlement e a aula gratuita continua aberta", () => {
  const free = { status: "PUBLISHED" as const, accessType: "FREE" as const };
  const paid = { status: "PUBLISHED" as const, accessType: "PAID" as const };
  assert.equal(canReadLessonBody(free), true);
  assert.equal(canReadLessonBody(paid), false);
  assert.equal(canReadLessonBody(paid, { entitled: false }), false);
  assert.equal(canReadLessonBody(paid, { entitled: true }), true);
  assert.deepEqual(visibleBlocks(paid, ["corpo"]), []);
  assert.deepEqual(visibleBlocks(paid, ["corpo"], { entitled: true }), ["corpo"]);
  assert.match(read("src/lib/learning/actions.ts"), /authorizedLesson/);
  assert.match(read("src/lib/learning/actions.ts"), /canReadLessonBody/);
});

test("ações privilegiadas revalidam autorização no próprio handler", () => {
  const authenticated = [
    "src/lib/commerce/actions.ts",
    "src/lib/project/actions.ts",
    "src/lib/diagnostic/actions.ts",
    "src/lib/plan/actions.ts",
    "src/lib/campaign-data/actions.ts",
  ];
  for (const file of authenticated) {
    for (const action of exportedBodies(read(file))) {
      assert.match(action.body, /requireSession\(/, file + " " + action.name);
      assert.match(action.body, /session\.user\.id/, file + " " + action.name);
    }
  }

  for (const action of exportedBodies(read("src/lib/editorial/actions.ts"))) {
    assert.match(action.body, /actor\(/, action.name);
  }
  assert.match(read("src/lib/editorial/actions.ts"), /requireAdmin\(/);

  for (const action of exportedBodies(read("src/lib/blog/actions.ts"))) {
    assert.match(action.body, /admin\(/, action.name);
  }
  assert.match(read("src/lib/blog/actions.ts"), /requireAdmin\(/);

  const learning = read("src/lib/learning/actions.ts");
  assert.match(learning, /async function saveTypedResponse[\s\S]{0,500}authorizedLesson\(/);
  for (const action of exportedBodies(learning)) {
    assert.match(action.body, /authorizedLesson\(|getSession\(|saveTypedResponse\(/, action.name);
    assert.doesNotMatch(action.body, /userId:\s*(input|raw|formData|payload)/, action.name);
  }
});

test("checkout não aceita userId nem role vindos do navegador", () => {
  const commerce = read("src/lib/commerce/actions.ts");
  assert.doesNotMatch(commerce, /userId|role/);
  assert.match(commerce, /createOrderForUser\(session\.user\.id/);
  assert.match(commerce, /preparePaymentAttempt\(session\.user\.id/);
  assert.match(commerce, /getOrderForUser\(session\.user\.id/);
  const orders = read("src/lib/commerce/orders.ts");
  assert.match(orders, /existing\.userId !== userId/);
  assert.match(orders, /raced\.userId !== userId/);
});

test("IA de blog é admin e IA de landing exige sessão e autorização", () => {
  const copy = read("src/lib/landing-page/copy/request.ts");
  assert.match(copy, /getSession\(/);
  assert.match(copy, /copyAssistAccessDecision/);
  assert.match(copy, /consumeCopyAssistRateLimit/);
  assert.match(read("src/lib/landing-page/copy/config.ts"), /OPENAI_API_KEY/);
  const clientFiles = walk("src").filter((file) => file.endsWith(".tsx") || file.endsWith(".ts"));
  for (const file of clientFiles) {
    const source = readFileSync(file, "utf8");
    if (!source.startsWith('"use client"') && !source.startsWith("'use client'")) continue;
    assert.doesNotMatch(source, /OPENAI_API_KEY|readOpenAICopyApiKey|BETTER_AUTH_SECRET/);
  }
});
