import assert from "node:assert/strict";
import { siteConfig } from "../src/data/site-config";
import robots from "../src/app/robots";
import sitemap from "../src/app/sitemap";

assert.equal(siteConfig.url, "https://alexandrefeio.com.br");
assert.doesNotMatch(siteConfig.url, /www\./);
assert.match(siteConfig.seo.title, /Alexandre Feio/);
assert.ok(siteConfig.seo.description.length > 40);
assert.ok(siteConfig.seo.description.length < 170);

const robotsFile = robots();
assert.equal(robotsFile.sitemap, "https://alexandrefeio.com.br/sitemap.xml");
assert.equal(robotsFile.host, "alexandrefeio.com.br");

const urls = sitemap().map((entry) => entry.url);
assert.deepEqual(urls, [
  "https://alexandrefeio.com.br",
  "https://alexandrefeio.com.br/trafego-pago",
  "https://alexandrefeio.com.br/privacidade",
]);
assert.ok(!urls.some((url) => url.includes("/app")));
assert.ok(!urls.some((url) => url.includes("/admin")));
assert.ok(!urls.some((url) => url.includes("/entrar")));
assert.ok(!urls.some((url) => url.includes("obrigado")));
assert.ok(!urls.some((url) => url.includes("www.")));
assert.ok(!urls.some((url) => url.includes("?")));

console.log("seo checks ok");
