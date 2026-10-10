import assert from "node:assert/strict";
import { config as loadEnv } from "dotenv";
import { siteConfig } from "../src/data/site-config";
import robots from "../src/app/robots";
import sitemap from "../src/app/sitemap";
import { buildPublicSitemap } from "../src/lib/seo/public-sitemap";

loadEnv({ path: ".env.local" });
loadEnv({ path: ".env" });

assert.equal(siteConfig.url, "https://alexandrefeio.com.br");
assert.doesNotMatch(siteConfig.url, /www\./);
assert.match(siteConfig.seo.title, /Alexandre Feio/);
assert.ok(siteConfig.seo.description.length > 40);
assert.ok(siteConfig.seo.description.length < 170);

const robotsFile = robots();
assert.equal(robotsFile.sitemap, "https://alexandrefeio.com.br/sitemap.xml");
assert.equal(robotsFile.host, "alexandrefeio.com.br");

async function main() {
const urls = (await sitemap()).map((entry) => entry.url);
for (const required of [
  "https://alexandrefeio.com.br",
  "https://alexandrefeio.com.br/trafego-pago",
  "https://alexandrefeio.com.br/privacidade",
]) {
  assert.ok(urls.includes(required), required);
}
const draftSitemap = buildPublicSitemap("https://alexandrefeio.com.br", {
  courses: [],
  lessons: [{ slug: "rascunho-interno", updatedAt: new Date(), indexable: false }],
});
assert.ok(!draftSitemap.some((entry) => entry.url.includes("rascunho-interno")));
assert.ok(!urls.some((url) => url.includes("rascunho-interno")));
assert.ok(!urls.some((url) => url.includes("/app")));
assert.ok(!urls.some((url) => url.includes("/admin")));
assert.ok(!urls.some((url) => url.includes("/entrar")));
assert.ok(!urls.some((url) => url.includes("obrigado")));
assert.ok(!urls.some((url) => url.includes("www.")));
assert.ok(!urls.some((url) => url.includes("?")));

console.log("seo checks ok");
}

main();
