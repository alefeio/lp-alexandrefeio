import assert from "node:assert/strict";
import { buildLeadEmail, deliverLeadEmail, prepareLead, validateLead } from "../src/lib/lead";

const valid = {
  name: "Ana Souza",
  company: "Clínica Exemplo",
  whatsapp: "91988887777",
  objective: "criar-site",
  extra: "",
  startedAt: Date.now() - 5000,
};

const prepared = prepareLead(valid);
assert.equal(prepared.ok, true);
if (!prepared.ok) process.exit(1);

const email = buildLeadEmail(prepared.lead);
assert.match(email.subject, /^Novo contato pelo site — Ana Souza$/);
assert.match(email.text, /NOVO CONTATO PELO SITE/);
assert.match(email.text, /Criar um site/);
assert.match(email.text, /alexandrefeio.com.br/);
assert.match(email.html, /https:\/\/wa\.me\/91988887777/);
assert.equal(email.html.includes("<script>"), false);

const hostile = prepareLead({
  ...valid,
  name: "Ana\r\nBcc: x",
  company: "<script>alert(1)</script>",
});
assert.equal(hostile.ok, true);
if (hostile.ok) {
  const hostileEmail = buildLeadEmail(hostile.lead);
  assert.equal(hostileEmail.subject.includes("\n"), false);
  assert.match(hostileEmail.html, /&lt;script&gt;/);
}

assert.ok(validateLead({ ...valid, name: " " }).name);
assert.ok(validateLead({ ...valid, whatsapp: "" }).whatsapp);
assert.ok(validateLead({ ...valid, objective: "invalido" }).objective);
assert.equal(validateLead(valid).company, undefined);

assert.equal(prepareLead({ ...valid, extra: "bot" }).ok, false);
assert.equal(prepareLead({ ...valid, startedAt: 0 }).ok, false);
assert.equal(prepareLead({ ...valid, startedAt: Date.now() }).ok, false);
assert.equal(prepareLead({ ...valid, objective: "invalido" }).ok, false);

async function main() {
  const sent = await deliverLeadEmail(email, async () => null);
  assert.equal(sent, "sent");

  const failed = await deliverLeadEmail(email, async () => ({ name: "validation_error", statusCode: 403 }));
  assert.equal(failed, "failed");

  const thrown = await deliverLeadEmail(email, async () => {
    throw new Error("network");
  });
  assert.equal(thrown, "failed");

  console.log("lead checks ok");
}

void main();
