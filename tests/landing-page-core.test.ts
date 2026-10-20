import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  COMPONENT_REGISTRY_V1,
  createEmptyLandingPageDocument,
  createLandingPageProject,
  createMemoryLandingPageStore,
  getLandingPageProject,
  isValidLandingPageSlug,
  LANDING_COMPONENT_REGISTRY_V1,
  LANDING_COMPONENT_TYPES,
  LANDING_PAGE_DOCUMENT_SCHEMA_VERSION,
  LANDING_PAGE_LIMITS,
  landingPageDocumentSchema,
  parseLandingPageDocument,
  sanitizeWhatsAppPhone,
  updateLandingPageDraft,
  updateLandingPageSlug,
  updateLandingPageTitle,
} from "../src/lib/landing-page";
import { sitesCourseSeed } from "../src/lib/learning/sites-course";
import { firstCourseSeed } from "../src/lib/learning/first-course";

function storeFor(userId = "user-a") {
  return createMemoryLandingPageStore({
    courseIdBySlug: { "sites-que-convertem": "course-sites" },
    projects: [
      { id: "project-a", userId },
      { id: "project-b", userId: "user-b" },
    ],
  });
}

test("default document válido com schemaVersion e registryVersion", () => {
  const doc = createEmptyLandingPageDocument();
  assert.equal(doc.schemaVersion, LANDING_PAGE_DOCUMENT_SCHEMA_VERSION);
  assert.equal(doc.registryVersion, LANDING_COMPONENT_REGISTRY_V1);
  assert.equal(doc.sections.length, 0);
  const parsed = landingPageDocumentSchema.safeParse(doc);
  assert.equal(parsed.success, true);
});

test("schemaVersion e registryVersion obrigatórios", () => {
  const base = createEmptyLandingPageDocument();
  assert.equal(parseLandingPageDocument({ ...base, schemaVersion: 2 }).ok, false);
  assert.equal(parseLandingPageDocument({ ...base, registryVersion: "OTHER" }).ok, false);
  assert.equal(parseLandingPageDocument({ ...base, schemaVersion: undefined }).ok, false);
});

test("section type e variant inválidos são rejeitados", () => {
  const doc = createEmptyLandingPageDocument();
  const badType = {
    ...doc,
    sections: [
      {
        id: "s1",
        type: "HERO_X",
        variant: "default",
        order: 0,
        enabled: true,
        content: { headline: "Oi" },
        settings: {},
      },
    ],
  };
  assert.equal(landingPageDocumentSchema.safeParse(badType).success, false);

  const badVariant = {
    ...doc,
    sections: [
      {
        id: "s1",
        type: "HERO",
        variant: "neon",
        order: 0,
        enabled: true,
        content: { headline: "Oi" },
        settings: {},
      },
    ],
  };
  assert.equal(landingPageDocumentSchema.safeParse(badVariant).success, false);
});

test("raw HTML e código arbitrário são rejeitados", () => {
  const doc = createEmptyLandingPageDocument();
  const withHtml = {
    ...doc,
    sections: [
      {
        id: "s1",
        type: "HERO",
        variant: "default",
        order: 0,
        enabled: true,
        content: { headline: "Oi", html: "<script>x</script>" },
        settings: {},
      },
    ],
  };
  assert.equal(landingPageDocumentSchema.safeParse(withHtml).success, false);

  const withScript = {
    ...doc,
    sections: [
      {
        id: "s1",
        type: "HERO",
        variant: "default",
        order: 0,
        enabled: true,
        content: { headline: "Oi", customCode: "alert(1)" },
        settings: {},
      },
    ],
  };
  assert.equal(landingPageDocumentSchema.safeParse(withScript).success, false);
});

test("URLs inseguras e javascript:/data: são rejeitadas", () => {
  const doc = createEmptyLandingPageDocument();
  for (const url of ["javascript:alert(1)", "data:text/html,hi", "vbscript:x", "ftp://x.com"]) {
    const withUrl = {
      ...doc,
      sections: [
        {
          id: "s1",
          type: "CTA",
          variant: "default",
          order: 0,
          enabled: true,
          content: {
            heading: "CTA",
            action: { type: "EXTERNAL_URL", url },
          },
          settings: {},
        },
      ],
    };
    assert.equal(landingPageDocumentSchema.safeParse(withUrl).success, false, url);
  }

  const safe = {
    ...doc,
    sections: [
      {
        id: "s1",
        type: "CTA",
        variant: "default",
        order: 0,
        enabled: true,
        content: {
          heading: "CTA",
          action: { type: "EXTERNAL_URL", url: "https://exemplo.com/x" },
        },
        settings: {},
      },
    ],
  };
  assert.equal(landingPageDocumentSchema.safeParse(safe).success, true);
});

test("limites de sections, FAQ, benefits e process", () => {
  const doc = createEmptyLandingPageDocument();
  const tooManySections = {
    ...doc,
    sections: Array.from({ length: LANDING_PAGE_LIMITS.maxSections + 1 }, (_, index) => ({
      id: `s${index}`,
      type: "HERO" as const,
      variant: "default" as const,
      order: index,
      enabled: true,
      content: { headline: `H${index}` },
      settings: {},
    })),
  };
  assert.equal(landingPageDocumentSchema.safeParse(tooManySections).success, false);

  const tooManyFaq = {
    ...doc,
    sections: [
      {
        id: "faq",
        type: "FAQ",
        variant: "default",
        order: 0,
        enabled: true,
        content: {
          items: Array.from({ length: LANDING_PAGE_LIMITS.maxFaqItems + 1 }, (_, i) => ({
            question: `Q${i}`,
            answer: `A${i}`,
          })),
        },
        settings: {},
      },
    ],
  };
  assert.equal(landingPageDocumentSchema.safeParse(tooManyFaq).success, false);

  const tooManyBenefits = {
    ...doc,
    sections: [
      {
        id: "b",
        type: "BENEFITS",
        variant: "default",
        order: 0,
        enabled: true,
        content: {
          items: Array.from({ length: LANDING_PAGE_LIMITS.maxBenefits + 1 }, (_, i) => ({
            title: `T${i}`,
            description: `D${i}`,
          })),
        },
        settings: {},
      },
    ],
  };
  assert.equal(landingPageDocumentSchema.safeParse(tooManyBenefits).success, false);

  const tooManySteps = {
    ...doc,
    sections: [
      {
        id: "p",
        type: "PROCESS",
        variant: "default",
        order: 0,
        enabled: true,
        content: {
          steps: Array.from({ length: LANDING_PAGE_LIMITS.maxProcessSteps + 1 }, (_, i) => ({
            title: `T${i}`,
            description: `D${i}`,
          })),
        },
        settings: {},
      },
    ],
  };
  assert.equal(landingPageDocumentSchema.safeParse(tooManySteps).success, false);
});

test("WhatsApp action valida e sanitiza telefone", () => {
  assert.equal(sanitizeWhatsAppPhone("(91) 98577-6798"), "91985776798");
  assert.equal(sanitizeWhatsAppPhone("123"), null);

  const doc = createEmptyLandingPageDocument();
  const valid = {
    ...doc,
    sections: [
      {
        id: "cta",
        type: "CTA",
        variant: "default",
        order: 0,
        enabled: true,
        content: {
          heading: "Fale",
          action: { type: "WHATSAPP", phone: "+55 91 98577-6798", message: "Oi" },
        },
        settings: {},
      },
    ],
  };
  const parsed = landingPageDocumentSchema.safeParse(valid);
  assert.equal(parsed.success, true);
  if (parsed.success) {
    assert.match(JSON.stringify(parsed.data.sections[0]), /"phone":"5591985776798"/);
  }

  const invalid = {
    ...doc,
    sections: [
      {
        id: "cta",
        type: "CTA",
        variant: "default",
        order: 0,
        enabled: true,
        content: {
          heading: "Fale",
          action: { type: "WHATSAPP", phone: "12" },
        },
        settings: {},
      },
    ],
  };
  assert.equal(landingPageDocumentSchema.safeParse(invalid).success, false);
});

test("component registry V1 cobre os tipos MVP", () => {
  assert.deepEqual([...LANDING_COMPONENT_TYPES], [
    "HERO",
    "PROBLEM",
    "SOLUTION",
    "BENEFITS",
    "PROCESS",
    "TRUST",
    "FAQ",
    "CTA",
    "FORM",
    "CONTACT",
    "FOOTER",
  ]);
  for (const type of LANDING_COMPONENT_TYPES) {
    assert.ok(COMPONENT_REGISTRY_V1[type]);
    assert.ok(COMPONENT_REGISTRY_V1[type].variants.length > 0);
  }
});

test("create project: DRAFT, revision 1, course sites, Project opcional", async () => {
  const store = storeFor();
  const created = await createLandingPageProject(store, {
    userId: "user-a",
    title: "Landing Ultrassonografia",
    slug: "ultrassonografia-obstetrica",
    projectId: "project-a",
  });
  assert.equal(created.ok, true);
  if (!created.ok) return;
  assert.equal(created.value.status, "DRAFT");
  assert.equal(created.value.draftRevision, 1);
  assert.equal(created.value.courseId, "course-sites");
  assert.equal(created.value.projectId, "project-a");
  assert.equal(created.value.draftDocument.schemaVersion, 1);

  const second = await createLandingPageProject(store, {
    userId: "user-a",
    title: "Outra página",
    slug: "outra-pagina",
  });
  assert.equal(second.ok, true);
  if (!second.ok) return;
  assert.equal(second.value.projectId, null);
  assert.notEqual(second.value.id, created.value.id);
});

test("Project de outro usuário é NOT_FOUND", async () => {
  const store = storeFor();
  const created = await createLandingPageProject(store, {
    userId: "user-a",
    title: "X",
    slug: "pagina-x",
    projectId: "project-b",
  });
  assert.equal(created.ok, false);
  if (created.ok) return;
  assert.equal(created.code, "NOT_FOUND");
});

test("ownership: owner lê/atualiza; outro usuário não", async () => {
  const store = storeFor();
  const created = await createLandingPageProject(store, {
    userId: "user-a",
    title: "Minha",
    slug: "minha-landing",
  });
  assert.equal(created.ok, true);
  if (!created.ok) return;

  const owned = await getLandingPageProject(store, {
    userId: "user-a",
    landingPageProjectId: created.value.id,
  });
  assert.equal(owned.ok, true);

  const foreign = await getLandingPageProject(store, {
    userId: "user-b",
    landingPageProjectId: created.value.id,
  });
  assert.equal(foreign.ok, false);
  if (!foreign.ok) assert.equal(foreign.code, "NOT_FOUND");

  const doc = createEmptyLandingPageDocument();
  const updateOwner = await updateLandingPageDraft(store, {
    userId: "user-a",
    landingPageProjectId: created.value.id,
    expectedRevision: 1,
    document: doc,
  });
  assert.equal(updateOwner.ok, true);

  const updateForeign = await updateLandingPageDraft(store, {
    userId: "user-b",
    landingPageProjectId: created.value.id,
    expectedRevision: 2,
    document: doc,
  });
  assert.equal(updateForeign.ok, false);
  if (!updateForeign.ok) assert.equal(updateForeign.code, "NOT_FOUND");
});

test("optimistic concurrency: success, increment, stale conflict", async () => {
  const store = storeFor();
  const created = await createLandingPageProject(store, {
    userId: "user-a",
    title: "Conc",
    slug: "concurrency-landing",
  });
  assert.equal(created.ok, true);
  if (!created.ok) return;

  const doc = createEmptyLandingPageDocument();
  const first = await updateLandingPageDraft(store, {
    userId: "user-a",
    landingPageProjectId: created.value.id,
    expectedRevision: 1,
    document: doc,
  });
  assert.equal(first.ok, true);
  if (!first.ok) return;
  assert.equal(first.value.draftRevision, 2);

  const stale = await updateLandingPageDraft(store, {
    userId: "user-a",
    landingPageProjectId: created.value.id,
    expectedRevision: 1,
    document: doc,
  });
  assert.equal(stale.ok, false);
  if (!stale.ok) assert.equal(stale.code, "LANDING_PAGE_DRAFT_CONFLICT");

  const second = await updateLandingPageDraft(store, {
    userId: "user-a",
    landingPageProjectId: created.value.id,
    expectedRevision: 2,
    document: doc,
  });
  assert.equal(second.ok, true);
  if (!second.ok) return;
  assert.equal(second.value.draftRevision, 3);
});

test("slug validation, duplicate, editable before publication, locked after", async () => {
  assert.equal(isValidLandingPageSlug("ultrassonografia-obstetrica"), true);
  assert.equal(isValidLandingPageSlug("Bad Slug"), false);
  assert.equal(isValidLandingPageSlug("admin"), false);
  assert.equal(isValidLandingPageSlug("../x"), false);

  const store = storeFor();
  const a = await createLandingPageProject(store, {
    userId: "user-a",
    title: "A",
    slug: "slug-a",
  });
  assert.equal(a.ok, true);
  if (!a.ok) return;

  const dup = await createLandingPageProject(store, {
    userId: "user-a",
    title: "B",
    slug: "slug-a",
  });
  assert.equal(dup.ok, false);
  if (!dup.ok) assert.equal(dup.code, "SLUG_TAKEN");

  const renamed = await updateLandingPageSlug(store, {
    userId: "user-a",
    landingPageProjectId: a.value.id,
    slug: "slug-a-novo",
  });
  assert.equal(renamed.ok, true);

  store.seedPublication(a.value.id);
  const locked = await updateLandingPageSlug(store, {
    userId: "user-a",
    landingPageProjectId: a.value.id,
    slug: "slug-a-depois",
  });
  assert.equal(locked.ok, false);
  if (!locked.ok) assert.equal(locked.code, "LANDING_PAGE_SLUG_LOCKED_AFTER_PUBLICATION");
});

test("title update e unsupported schema na leitura", async () => {
  const store = storeFor();
  const created = await createLandingPageProject(store, {
    userId: "user-a",
    title: "Antes",
    slug: "titulo-landing",
  });
  assert.equal(created.ok, true);
  if (!created.ok) return;

  const titled = await updateLandingPageTitle(store, {
    userId: "user-a",
    landingPageProjectId: created.value.id,
    title: "Depois",
  });
  assert.equal(titled.ok, true);
  if (!titled.ok) return;
  assert.equal(titled.value.title, "Depois");

  const row = store.rows.get(created.value.id)!;
  row.draftDocument = { ...row.draftDocument, schemaVersion: 99 as never };
  const broken = await getLandingPageProject(store, {
    userId: "user-a",
    landingPageProjectId: created.value.id,
  });
  assert.equal(broken.ok, false);
  if (!broken.ok) assert.equal(broken.code, "UNSUPPORTED_SCHEMA_VERSION");
});

test("regressão: curso sites DRAFT/NFS; curso 1 intacto; migration aditiva", () => {
  assert.equal(sitesCourseSeed.status, "DRAFT");
  assert.equal(sitesCourseSeed.commerceStatus, "NOT_FOR_SALE");
  assert.equal(firstCourseSeed.slug, "trafego-pago-na-pratica");
  assert.equal(firstCourseSeed.bundlePriceCents, 24990);

  const sql = readFileSync(
    new URL("../prisma/migrations/20261020180000_add_landing_page_builder_core/migration.sql", import.meta.url),
    "utf8",
  );
  assert.match(sql, /CREATE TYPE "LandingPageStatus"/);
  assert.match(sql, /CREATE TABLE "landing_page_project"/);
  assert.match(sql, /CREATE TABLE "landing_page_publication"/);
  assert.match(sql, /draftRevision/);
  assert.equal(/\bDROP\b/i.test(sql), false);
  assert.equal(/\bTRUNCATE\b/i.test(sql), false);
  assert.equal(/\bDELETE FROM\b/i.test(sql), false);
  assert.equal(/ALTER TABLE .* DROP/i.test(sql), false);
  assert.match(sql, /ON DELETE/);

  const schema = readFileSync(new URL("../prisma/schema.prisma", import.meta.url), "utf8");
  assert.match(schema, /model LandingPageProject/);
  assert.match(schema, /model LandingPagePublication/);
  assert.match(schema, /LandingPageActivePublication/);
  assert.match(schema, /LandingPagePublicationHistory/);

  const adr = readFileSync(new URL("../docs/adr/landing-page-builder-v1.md", import.meta.url), "utf8");
  assert.match(adr, /schemaVersion/);
  assert.match(adr, /draftRevision/);
  assert.match(adr, /PHASE 1/);
});

test("nenhuma UI pública do builder exposta", () => {
  const home = readFileSync(new URL("../src/components/home/CourseHome.tsx", import.meta.url), "utf8");
  const nav = readFileSync(new URL("../src/data/navigation.ts", import.meta.url), "utf8");
  assert.equal(home.includes("LandingPage"), false);
  assert.equal(home.includes("/p/"), false);
  assert.equal(nav.includes("landing"), false);
});
