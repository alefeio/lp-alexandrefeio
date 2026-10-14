import assert from "node:assert/strict";
import test from "node:test";
import { authCtaParams } from "../src/lib/analytics";
import { accountNavLabels } from "../src/lib/auth/account-nav";
import { authNextHref, safeReturnPath, verificationCallbackPath, verificationView } from "../src/lib/auth/messages";
import { canReadLessonBody } from "../src/lib/learning/access";
import { passwordResetEmail, verificationEmail } from "../src/lib/email/auth-mail";
import { purchaseEmail } from "../src/lib/email/purchase-mail";
import { lessonAccountNext, showAnonymousStudyCard } from "../src/lib/learning/save-progress";
import { studentAreaState } from "../src/lib/learning/student-home";

const lessonNext = "/aulas/como-anuncio-pago-encontra-cliente#o-que-acontece";

test("verificação distingue espera, confirmação e token inválido", () => {
  assert.equal(verificationView({}), "pending");
  assert.equal(verificationView({ confirmado: null, error: null }), "pending");
  assert.equal(verificationView({ confirmado: "1" }), "confirmed");
  assert.equal(verificationView({ confirmado: "1", error: "INVALID_TOKEN" }), "invalid");
  assert.equal(verificationView({ error: "TOKEN_EXPIRED" }), "invalid");
});

test("next interno entra no retorno e next externo é recusado", () => {
  assert.equal(safeReturnPath(lessonNext), lessonNext);
  assert.equal(safeReturnPath("https://evil.example/phish"), null);
  assert.equal(safeReturnPath("//evil.example"), null);
  const login = authNextHref("/entrar", lessonNext);
  assert.equal(login, `/entrar?next=${encodeURIComponent(lessonNext)}`);
  assert.equal(authNextHref("/cadastro", "https://evil.example"), "/cadastro");
  assert.equal(verificationCallbackPath(lessonNext).startsWith("/verificar-email?confirmado=1&next="), true);
  assert.equal(verificationCallbackPath("https://evil.example").includes("evil"), false);
});

test("header anônimo e autenticado expõem ações diferentes", () => {
  assert.deepEqual(accountNavLabels(false), ["Entrar", "Criar conta"]);
  assert.deepEqual(accountNavLabels(true), ["Área do aluno", "Sair"]);
});

test("aula gratuita anônima mostra o aviso e a autenticada não exige login", () => {
  assert.equal(showAnonymousStudyCard({ authenticated: false, preview: false, accessType: "FREE" }), true);
  assert.equal(showAnonymousStudyCard({ authenticated: true, preview: false, accessType: "FREE" }), false);
  assert.equal(showAnonymousStudyCard({ authenticated: false, preview: true, accessType: "FREE" }), false);
  assert.equal(canReadLessonBody({ status: "PUBLISHED", accessType: "FREE" }), true);
  assert.equal(lessonAccountNext("como-anuncio-pago-encontra-cliente", "o-que-acontece"), lessonNext);
  const params = authCtaParams("lesson_header", "signup");
  assert.deepEqual(params, { source: "lesson_header", action: "signup" });
  assert.equal("email" in params, false);
});

test("área do aluno reconhece concluída, em andamento e vazio", () => {
  const empty = studentAreaState({ inProgress: [], completed: [], nextLesson: null });
  assert.equal(empty.continue.kind, "empty");
  assert.equal(empty.learning.length, 0);

  const done = studentAreaState({
    inProgress: [],
    completed: [{ slug: "como-anuncio-pago-encontra-cliente", title: "Como um anúncio pago encontra um cliente", percent: 100 }],
    nextLesson: { slug: "google-ads-ou-meta-ads", title: "Google Ads ou Meta Ads: qual escolher?" },
  });
  assert.equal(done.continue.kind, "completed");
  if (done.continue.kind === "completed") {
    assert.equal(done.continue.headline, "Você concluiu sua primeira aula.");
    assert.equal(done.continue.next?.title, "Google Ads ou Meta Ads: qual escolher?");
  }
  assert.equal(done.learning[0]?.status, "completed");

  const both = studentAreaState({
    inProgress: [{ slug: "google-ads-ou-meta-ads", title: "Google Ads ou Meta Ads: qual escolher?", percent: 45 }],
    completed: [{ slug: "como-anuncio-pago-encontra-cliente", title: "Aula 1", percent: 100 }],
    nextLesson: null,
  });
  assert.equal(both.continue.kind, "resume");
  if (both.continue.kind === "resume") assert.equal(both.continue.lesson.percent, 45);
  assert.deepEqual(
    both.learning.map((item) => item.status),
    ["in_progress", "completed"],
  );
});

test("e-mails de confirmação e redefinição usam a marca e o link alternativo", () => {
  const confirmUrl = "https://alexandrefeio.com.br/api/auth/verify-email?token=abc&callbackURL=%2Fverificar-email";
  const confirm = verificationEmail(confirmUrl);
  assert.equal(confirm.subject, "Confirme seu e-mail — Alexandre Feio");
  assert.match(confirm.html, /Alexandre Feio/);
  assert.match(confirm.html, /Confirmar meu e-mail/);
  assert.match(confirm.html, /Se o botão não funcionar, copie e cole este endereço no navegador:/);
  assert.match(confirm.html, /#0B1220/i);
  assert.match(confirm.html, /#1E5EFF/i);
  assert.match(confirm.html, /#FF7A45/i);
  assert.match(confirm.html, /#F8FAFC/i);
  assert.equal(confirm.html.includes("Tráfego Pago + Estrutura de Conversão"), false);
  assert.match(confirm.text, /Aprendizado e estratégia digital na prática/);
  assert.match(confirm.html, /token=abc/);

  const hostile = verificationEmail(`https://alexandrefeio.com.br/verify?q=${encodeURIComponent(`"><script>`)}`);
  assert.equal(hostile.html.includes("<script>"), false);

  const reset = passwordResetEmail("https://alexandrefeio.com.br/api/auth/reset-password/token-1");
  assert.equal(reset.subject, "Redefina sua senha — Alexandre Feio");
  assert.match(reset.html, /Redefinir senha/);
  assert.match(reset.html, /Alexandre Feio/);
  assert.equal(reset.html.includes("Tráfego Pago + Estrutura de Conversão"), false);

  const purchase = purchaseEmail({
    items: ["Aula <paga>"],
    totalLabel: "R$ 10",
    learnUrl: "https://alexandrefeio.com.br/app/aprendizado",
  });
  assert.match(purchase.html, /Alexandre Feio/);
  assert.match(purchase.html, /Aula &lt;paga&gt;/);
  assert.match(purchase.html, /Continuar aprendendo/);
});
