import assert from "node:assert/strict";
import { deflateRawSync } from "node:zlib";
import ExcelJS from "exceljs";
import test from "node:test";
import { authorizeUpload, sameOwner, uploadGrant, uploadsAllowed } from "../src/lib/campaign-data/access";
import { parseCsv } from "../src/lib/campaign-data/csv";
import { CampaignDataError } from "../src/lib/campaign-data/errors";
import { declaredFormat, sniffFormat } from "../src/lib/campaign-data/format";
import { inspectBytes } from "../src/lib/campaign-data/inspect";
import { CAMPAIGN_DATA_LIMITS } from "../src/lib/campaign-data/limits";
import { suggestColumns } from "../src/lib/campaign-data/mapping";
import { conversionRate, costPerQualifiedLead, cpa, cpc, cpl, ctr, qualificationRate, roas, sumBases } from "../src/lib/campaign-data/metrics";
import { normalizeSheet } from "../src/lib/campaign-data/normalize";
import { detectNumberLocale, parseLocalizedNumber } from "../src/lib/campaign-data/numbers";
import { opaqueId, pathnameMatchesImport, rawStoragePath } from "../src/lib/campaign-data/paths";
import { deletePrivateObjects, createMemoryStorage } from "../src/lib/campaign-data/storage";
import { assertRealXlsx, readZipEntries } from "../src/lib/campaign-data/zip-package";
import { parseXlsx } from "../src/lib/campaign-data/xlsx";

const projectId = "cm1234567890abcd";
const importId = "cmabcdef12345678";

function storedZip(files: Array<{ name: string; data: Buffer; uncompressed?: number }>): Buffer {
  const parts: Buffer[] = [];
  for (const file of files) {
    const name = Buffer.from(file.name);
    const compressed = deflateRawSync(file.data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(8, 8);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(file.uncompressed ?? file.data.length, 22);
    local.writeUInt16LE(name.length, 26);
    parts.push(local, name, compressed);
  }
  return Buffer.concat(parts);
}

async function workbookBuffer(build: (workbook: ExcelJS.Workbook) => void): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  build(workbook);
  const output = await workbook.xlsx.writeBuffer();
  return Buffer.from(output);
}

test("upload exige sessão, dono e pathname opaco", () => {
  const pathname = rawStoragePath(projectId, importId, "CSV");
  assert.equal(opaqueId("aluno@email.com"), false);
  assert.throws(() => rawStoragePath("aluno@email.com", importId, "CSV"));
  assert.equal(pathnameMatchesImport(pathname, projectId, importId), true);
  assert.equal(pathname.includes("email"), false);
  const denied = authorizeUpload({
    sessionUserId: null,
    projectOwnerId: "user-a",
    projectId,
    importId,
    pathname,
    sizeBytes: 100,
    fileName: "relatorio.csv",
    env: {},
  });
  assert.equal(denied.ok, false);
  const other = authorizeUpload({
    sessionUserId: "user-b",
    projectOwnerId: "user-a",
    projectId,
    importId,
    pathname,
    sizeBytes: 100,
    fileName: "relatorio.csv",
    env: {},
  });
  assert.equal(other.ok, false);
  assert.equal(sameOwner("user-b", "user-a"), false);
  const allowed = authorizeUpload({
    sessionUserId: "user-a",
    projectOwnerId: "user-a",
    projectId,
    importId,
    pathname,
    sizeBytes: 100,
    fileName: "relatorio.csv",
    env: {},
  });
  assert.equal(allowed.ok, true);
  const grant = uploadGrant(1_000, pathname);
  assert.equal(grant.access, "private");
  assert.deepEqual(grant.operations, ["put"]);
  assert.equal(grant.validUntil - 1_000, CAMPAIGN_DATA_LIMITS.uploadGrantMs);
  assert.equal(uploadsAllowed({ VERCEL_ENV: "preview" }), false);
  assert.equal(uploadsAllowed({ VERCEL_ENV: "production" }), true);
});

test("formato, tamanho e planilha disfarçada são recusados", () => {
  assert.equal(declaredFormat("relatorio.csv"), "CSV");
  assert.equal(declaredFormat("relatorio.xlsx"), "XLSX");
  assert.equal(declaredFormat("relatorio.xls"), null);
  assert.equal(declaredFormat("macro.xlsm"), null);
  const tooBig = authorizeUpload({
    sessionUserId: "user-a",
    projectOwnerId: "user-a",
    projectId,
    importId,
    pathname: rawStoragePath(projectId, importId, "CSV"),
    sizeBytes: CAMPAIGN_DATA_LIMITS.maxFileBytes + 1,
    fileName: "relatorio.csv",
    env: {},
  });
  assert.equal(tooBig.ok, false);
  const mime = sniffFormat(Buffer.from("campanha,cliques\nA,1\n"));
  assert.equal(mime, "CSV");
  const ole = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0, 0]);
  assert.throws(() => sniffFormat(ole), (error: unknown) => error instanceof CampaignDataError && error.code === "UNSUPPORTED_FORMAT");
  const macro = storedZip([
    { name: "xl/vbaProject.bin", data: Buffer.from("macro") },
    { name: "[Content_Types].xml", data: Buffer.from("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml") },
    { name: "xl/workbook.xml", data: Buffer.from("<workbook/>") },
  ]);
  assert.throws(() => assertRealXlsx(readZipEntries(macro)), (error: unknown) => error instanceof CampaignDataError && error.code === "INVALID_XLSX");
  const bomb = storedZip([{ name: "[Content_Types].xml", data: Buffer.from("a"), uncompressed: CAMPAIGN_DATA_LIMITS.maxUncompressedBytes + 1 }]);
  assert.throws(() => readZipEntries(bomb), (error: unknown) => error instanceof CampaignDataError && error.code === "FILE_TOO_LARGE");
});

test("CSV lê separadores, BOM, números e limites", async () => {
  const comma = parseCsv(Buffer.from("Campanha,Cliques\nMóveis,2\n"));
  assert.deepEqual(comma.sheet.headers, ["Campanha", "Cliques"]);
  assert.equal(comma.sheet.rows[0]?.[1], "2");
  const semicolon = parseCsv(Buffer.from("Campanha;Cliques\nMóveis;2\n"));
  assert.equal(semicolon.sheet.rows[0]?.[0], "Móveis");
  const bom = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from("Campanha,Cliques\nA,0\n")]);
  const zero = parseCsv(bom);
  assert.equal(zero.sheet.rows[0]?.[1], "0");
  const brl = parseLocalizedNumber("R$ 1.234,56", "PT_BR");
  const usd = parseLocalizedNumber("1,234.56", "EN_US");
  assert.equal(brl.ok && brl.value, 1234.56);
  assert.equal(usd.ok && usd.value, 1234.56);
  assert.equal(detectNumberLocale(["1.234,56", "1,234.56"]), "AMBIGUOUS");
  assert.equal(parseLocalizedNumber("12%", "PT_BR").ok, false);
  const wide = `a,${Array.from({ length: CAMPAIGN_DATA_LIMITS.maxColumns }, () => "b").join(",")}\n`;
  assert.throws(() => parseCsv(Buffer.from(wide)), (error: unknown) => error instanceof CampaignDataError && error.code === "TOO_MANY_COLUMNS");
  const tall = ["Campanha,Cliques", ...Array.from({ length: CAMPAIGN_DATA_LIMITS.maxRows + 1 }, () => "A,1")].join("\n");
  assert.throws(() => parseCsv(Buffer.from(tall)), (error: unknown) => error instanceof CampaignDataError && error.code === "TOO_MANY_ROWS");
});

test("XLSX lê planilha, fórmula em cache e várias abas", async () => {
  const bytes = await workbookBuffer((workbook) => {
    const sheet = workbook.addWorksheet("Campanha");
    sheet.addRow(["Campanha", "Cliques", "Fórmula"]);
    sheet.addRow(["Móveis", 2, { formula: "1+1", result: 3 }]);
    sheet.addRow(["", null, { formula: "HYPERLINK(\"https://example.invalid\")" }]);
    workbook.addWorksheet("Outra");
  });
  let fetched = false;
  const original = globalThis.fetch;
  globalThis.fetch = (async () => {
    fetched = true;
    return new Response("");
  }) as typeof fetch;
  try {
    const parsed = await parseXlsx(bytes);
    assert.equal(fetched, false);
    assert.deepEqual(parsed.sheets.map((sheet) => sheet.name), ["Campanha", "Outra"]);
    assert.equal(parsed.sheets[1]?.rows.length, 0);
    const selected = await parseXlsx(bytes, "Campanha");
    assert.equal(selected.sheets[0]?.rows[0]?.[2], "3");
    assert.equal(selected.sheets[0]?.rows[1]?.[2], "");
  } finally {
    globalThis.fetch = original;
  }
  const many = await workbookBuffer((workbook) => {
    for (let index = 0; index < CAMPAIGN_DATA_LIMITS.maxSheets + 1; index += 1) workbook.addWorksheet(`Aba ${index}`);
  });
  await assert.rejects(() => parseXlsx(many), (error: unknown) => error instanceof CampaignDataError && error.code === "TOO_MANY_SHEETS");
  const csvNamedXlsx = await inspectBytes(Buffer.from("Campanha,Cliques\nA,1\n"));
  assert.equal(csvNamedXlsx.format, "CSV");
});

test("mapping sugere Google e Meta e não promove Resultados", () => {
  const google = suggestColumns(["Impressões", "Cliques", "Custo", "Conversões", "Campaign", "Keyword"], "GOOGLE_ADS");
  assert.deepEqual(google.map((column) => column.canonical), ["IMPRESSIONS", "CLICKS", "SPEND", "CONVERSIONS", "CAMPAIGN", "KEYWORD"]);
  const english = suggestColumns(["Impressions", "Clicks", "Cost", "Conversion value", "Ad group"], "GOOGLE_ADS");
  assert.deepEqual(english.map((column) => column.canonical), ["IMPRESSIONS", "CLICKS", "SPEND", "CONVERSION_VALUE", "AD_GROUP"]);
  const meta = suggestColumns(["Impressões", "Valor gasto", "Nome da campanha", "Conjunto de anúncios", "Resultados"], "META_ADS");
  assert.equal(meta[1]?.canonical, "SPEND");
  assert.equal(meta[3]?.canonical, "AD_SET");
  assert.equal(meta[4]?.canonical, null);
  assert.equal(meta[4]?.ambiguous, true);
  const metaEn = suggestColumns(["Amount spent", "Ad set name", "Results", "CTR"], "META_ADS");
  assert.equal(metaEn[0]?.canonical, "SPEND");
  assert.equal(metaEn[1]?.canonical, "AD_SET");
  assert.equal(metaEn[2]?.ambiguous, true);
  assert.equal(metaEn[3]?.sourceRatio, true);
  const duplicate = suggestColumns(["Cliques", "Cliques"], "GOOGLE_ADS");
  assert.equal(duplicate[0]?.canonical, "CLICKS");
  assert.equal(duplicate[1]?.canonical, null);
});

test("métricas somam a base e não inventam razão", () => {
  const totals = sumBases([
    { impressions: 100, clicks: 50, spend: 80, conversions: 4, leads: 10, qualifiedLeads: 2 },
    { impressions: 10, clicks: 1, spend: 20, conversions: 0, leads: 0, qualifiedLeads: 0 },
  ]);
  const clickRate = ctr(totals);
  const clickCost = cpc(totals);
  const rate = conversionRate(totals);
  const acquisition = cpa(totals);
  const leadCost = cpl(totals);
  const qualified = qualificationRate(totals);
  const qualifiedCost = costPerQualifiedLead(totals);
  assert.equal(clickRate.available && clickRate.value, 51 / 110);
  assert.notEqual(clickRate.available && clickRate.value, (0.5 + 0.1) / 2);
  assert.equal(clickCost.available && clickCost.value, 100 / 51);
  assert.equal(rate.available && rate.value, 4 / 51);
  assert.equal(acquisition.available && acquisition.value, 100 / 4);
  assert.equal(leadCost.available && leadCost.value, 100 / 10);
  assert.equal(qualified.available && qualified.value, 2 / 10);
  assert.equal(qualifiedCost.available && qualifiedCost.value, 100 / 2);
  const roasValue = roas({ spend: 50, conversionValue: 200 });
  assert.equal(roasValue.available && roasValue.value, 4);
  const missing = roas({ spend: 50 });
  assert.equal(missing.available, false);
  if (!missing.available) assert.ok(missing.missingFields.includes("CONVERSION_VALUE"));
  const zero = ctr({ impressions: 0, clicks: 0 });
  assert.equal(zero.available, false);
  const absent = cpa({ spend: 10 });
  assert.equal(absent.available, false);
});

test("normalização guarda zero e exclui percentual", () => {
  const normalized = normalizeSheet(
    {
      name: "CSV",
      headers: ["Cliques", "CTR"],
      rows: [["0", "10%"], ["2", ""]],
    },
    [
      { index: 0, header: "Cliques", canonical: "CLICKS" },
      { index: 1, header: "CTR", canonical: null },
    ],
    "PT_BR",
  );
  assert.equal(normalized.rowCount, 2);
  assert.ok(normalized.metrics.includes("CLICKS"));
  assert.equal(normalized.metrics.includes("CTR"), false);
});

test("exclusão apaga bruto e normalizado só do dono", async () => {
  const storage = createMemoryStorage();
  const raw = rawStoragePath(projectId, importId, "CSV");
  const normalized = `${raw.replace("raw.csv", "normalized.json.gz")}`;
  await storage.put(raw, Buffer.from("a"));
  await storage.put(normalized, Buffer.from("b"));
  assert.equal(sameOwner("user-b", "user-a"), false);
  await deletePrivateObjects(storage, [raw, normalized]);
  assert.deepEqual(storage.deleted, [raw, normalized]);
  assert.equal(await storage.get(raw), null);
  assert.equal(await storage.get(normalized), null);
});
