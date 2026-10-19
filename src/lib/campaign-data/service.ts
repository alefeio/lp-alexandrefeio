import { Prisma } from "@/generated/prisma/client";
import { getPrisma } from "@/lib/db/prisma";
import { ownedProject } from "@/lib/project/service";
import { uploadsAllowed } from "@/lib/campaign-data/access";
import { campaignDataMessage, CampaignDataError, type CampaignDataCode } from "@/lib/campaign-data/errors";
import { declaredFormat, rejectDeclaredName, assertSize } from "@/lib/campaign-data/format";
import { activeSheet, DUPLICATE_FILE_WARNING, inspectBytes, sha256Hex } from "@/lib/campaign-data/inspect";
import { CAMPAIGN_DATA_LIMITS } from "@/lib/campaign-data/limits";
import { suggestColumns } from "@/lib/campaign-data/mapping";
import { normalizeSheet } from "@/lib/campaign-data/normalize";
import { normalizedStoragePath, rawStoragePath } from "@/lib/campaign-data/paths";
import { createPrivateBlobStorage } from "@/lib/campaign-data/blob-storage";
import { deletePrivateObjects, type PrivateStorage } from "@/lib/campaign-data/storage";
import { CANONICAL_FIELDS, CURRENCIES, NUMBER_LOCALES, SOURCE_PLATFORMS, type CanonicalField, type CampaignCurrency, type ColumnSuggestion, type NumberLocale, type SourcePlatform } from "@/lib/campaign-data/types";

type Result<T> = { ok: true; message?: string } & T | { ok: false; code: CampaignDataCode; message: string };

function fail(code: CampaignDataCode): { ok: false; code: CampaignDataCode; message: string } {
  return { ok: false, code, message: campaignDataMessage(code) };
}

function logSafe(event: { importId: string; projectId: string; status: string; sizeBytes?: number; rowCount?: number | null; code?: string | null }) {
  console.info(JSON.stringify({ scope: "campaign-data", ...event }));
}

function storage(): PrivateStorage {
  return createPrivateBlobStorage();
}

function platformOf(value: string): SourcePlatform | null {
  return SOURCE_PLATFORMS.includes(value as SourcePlatform) ? (value as SourcePlatform) : null;
}

function draftOf(value: unknown): { headers: string[]; suggestions: ColumnSuggestion[] } | null {
  if (!value || typeof value !== "object") return null;
  const record = value as { headers?: unknown; suggestions?: unknown };
  if (!Array.isArray(record.headers) || !Array.isArray(record.suggestions)) return null;
  return { headers: record.headers.filter((item): item is string => typeof item === "string"), suggestions: record.suggestions as ColumnSuggestion[] };
}

async function ownedImport(userId: string, projectId: string, importId: string) {
  const project = await getPrisma().project.findFirst({ where: ownedProject(userId, projectId), select: { id: true } });
  if (!project) return null;
  return getPrisma().campaignDataImport.findFirst({ where: { id: importId, projectId, userId } });
}

export async function prepareCampaignImport(
  userId: string,
  projectId: string,
  input: { fileName: string; sizeBytes: number; sourcePlatform: string; mimeType?: string },
  env: Record<string, string | undefined> = process.env,
): Promise<Result<{ importId: string; pathname: string }>> {
  if (!uploadsAllowed(env)) return fail("UPLOADS_DISABLED");
  const sourcePlatform = platformOf(input.sourcePlatform);
  if (!sourcePlatform) return fail("PARSE_FAILED");
  try {
    rejectDeclaredName(input.fileName);
    assertSize(input.sizeBytes);
  } catch (error) {
    if (error instanceof CampaignDataError) return fail(error.code);
    return fail("PARSE_FAILED");
  }
  const format = declaredFormat(input.fileName);
  if (!format) return fail("UNSUPPORTED_FORMAT");
  const project = await getPrisma().project.findFirst({ where: ownedProject(userId, projectId), select: { id: true } });
  if (!project) return fail("NOT_FOUND");
  const created = await getPrisma().campaignDataImport.create({
    data: {
      userId,
      projectId,
      sourcePlatform,
      fileFormat: format,
      originalFileName: input.fileName.slice(0, CAMPAIGN_DATA_LIMITS.maxHeaderLength),
      mimeType: input.mimeType?.slice(0, 120) ?? null,
      sizeBytes: input.sizeBytes,
      rawStoragePath: "pending",
      status: "PENDING_UPLOAD",
    },
  });
  const pathname = rawStoragePath(projectId, created.id, format);
  await getPrisma().campaignDataImport.update({ where: { id: created.id }, data: { rawStoragePath: pathname } });
  return { ok: true, importId: created.id, pathname };
}

export async function finalizeCampaignImport(userId: string, projectId: string, importId: string): Promise<Result<{ status: string }>> {
  const row = await ownedImport(userId, projectId, importId);
  if (!row || row.status === "DELETED") return fail("NOT_FOUND");
  if (row.status !== "PENDING_UPLOAD") return { ok: true, status: row.status };
  try {
    const bytes = await storage().get(row.rawStoragePath);
    if (!bytes) return fail("STORAGE_FAILED");
    const digest = sha256Hex(bytes);
    const duplicate = await getPrisma().campaignDataImport.findFirst({
      where: { userId, projectId, sha256: digest, deletedAt: null, id: { not: row.id }, status: { not: "DELETED" } },
      select: { id: true },
    });
    const workbook = await inspectBytes(bytes);
    const warnings = [...workbook.warnings];
    if (duplicate) warnings.push(DUPLICATE_FILE_WARNING);
    const sheet = activeSheet(workbook);
    if (!sheet) {
      await getPrisma().campaignDataImport.update({
        where: { id: row.id },
        data: {
          status: "NEEDS_SHEET_SELECTION",
          fileFormat: workbook.format,
          sha256: digest,
          sizeBytes: bytes.byteLength,
          sheetNames: workbook.sheets.map((item) => item.name),
          warnings,
          parsedAt: new Date(),
        },
      });
      return { ok: true, status: "NEEDS_SHEET_SELECTION", message: duplicate ? DUPLICATE_FILE_WARNING : undefined };
    }
    await getPrisma().campaignDataImport.update({
      where: { id: row.id },
      data: {
        status: "NEEDS_MAPPING",
        fileFormat: workbook.format,
        sha256: digest,
        sizeBytes: bytes.byteLength,
        sheetNames: workbook.sheets.map((item) => item.name),
        selectedSheet: sheet.name,
        rowCount: sheet.rows.length,
        columnCount: sheet.headers.length,
        columnMapping: { headers: sheet.headers, suggestions: suggestColumns(sheet.headers, row.sourcePlatform) },
        warnings,
        parsedAt: new Date(),
      },
    });
    return { ok: true, status: "NEEDS_MAPPING", message: duplicate ? DUPLICATE_FILE_WARNING : undefined };
  } catch (error) {
    const code = error instanceof CampaignDataError ? error.code : "PARSE_FAILED";
    await getPrisma().campaignDataImport.update({ where: { id: row.id }, data: { status: "FAILED", failureCode: code, parsedAt: new Date() } });
    logSafe({ importId: row.id, projectId, status: "FAILED", code });
    return fail(code);
  }
}

export async function selectCampaignSheet(userId: string, projectId: string, importId: string, sheetName: string): Promise<Result<{ status: string }>> {
  const row = await ownedImport(userId, projectId, importId);
  if (!row || row.status === "DELETED") return fail("NOT_FOUND");
  const names = Array.isArray(row.sheetNames) ? row.sheetNames.filter((item): item is string => typeof item === "string") : [];
  if (!names.includes(sheetName)) return fail("PARSE_FAILED");
  try {
    const bytes = await storage().get(row.rawStoragePath);
    if (!bytes) return fail("STORAGE_FAILED");
    const workbook = await inspectBytes(bytes, sheetName);
    const sheet = activeSheet(workbook, sheetName);
    if (!sheet || sheet.headers.length === 0) return fail("PARSE_FAILED");
    await getPrisma().campaignDataImport.update({
      where: { id: row.id },
      data: {
        status: "NEEDS_MAPPING",
        selectedSheet: sheet.name,
        rowCount: sheet.rows.length,
        columnCount: sheet.headers.length,
        columnMapping: { headers: sheet.headers, suggestions: suggestColumns(sheet.headers, row.sourcePlatform) },
        warnings: [...(Array.isArray(row.warnings) ? row.warnings.filter((item): item is string => typeof item === "string") : []), ...workbook.warnings],
      },
    });
    return { ok: true, status: "NEEDS_MAPPING" };
  } catch (error) {
    const code = error instanceof CampaignDataError ? error.code : "PARSE_FAILED";
    await getPrisma().campaignDataImport.update({ where: { id: row.id }, data: { status: "FAILED", failureCode: code } });
    logSafe({ importId: row.id, projectId, status: "FAILED", code });
    return fail(code);
  }
}

export async function confirmCampaignMapping(
  userId: string,
  projectId: string,
  importId: string,
  input: { columns: Array<{ index: number; canonical: string }>; locale: string; currency: string },
): Promise<Result<{ status: string }>> {
  const row = await ownedImport(userId, projectId, importId);
  if (!row || row.status !== "NEEDS_MAPPING") return fail("NOT_FOUND");
  const draft = draftOf(row.columnMapping);
  if (!draft) return fail("MAPPING_REQUIRED");
  if (!NUMBER_LOCALES.includes(input.locale as NumberLocale) || !CURRENCIES.includes(input.currency as CampaignCurrency)) {
    return fail("MAPPING_REQUIRED");
  }
  const chosen = new Map(input.columns.map((column) => [column.index, column.canonical]));
  const used = new Set<CanonicalField>();
  let columns;
  try {
    columns = draft.headers.map((header, index) => {
      const suggestion = draft.suggestions.find((item) => item.index === index);
      const raw = chosen.get(index) ?? "";
      if (suggestion?.ambiguous && raw !== "IGNORE" && !CANONICAL_FIELDS.includes(raw as CanonicalField)) {
        throw new CampaignDataError("MAPPING_REQUIRED");
      }
      if (!raw || raw === "IGNORE") return { index, header, canonical: null };
      if (!CANONICAL_FIELDS.includes(raw as CanonicalField) || used.has(raw as CanonicalField)) {
        throw new CampaignDataError("MAPPING_REQUIRED");
      }
      used.add(raw as CanonicalField);
      return { index, header, canonical: raw as CanonicalField };
    });
    const bytes = await storage().get(row.rawStoragePath);
    if (!bytes) return fail("STORAGE_FAILED");
    const workbook = await inspectBytes(bytes, row.selectedSheet ?? undefined);
    const sheet = activeSheet(workbook, row.selectedSheet ?? undefined);
    if (!sheet) return fail("PARSE_FAILED");
    await getPrisma().campaignDataImport.update({ where: { id: row.id }, data: { status: "PROCESSING" } });
    const normalized = normalizeSheet(sheet, columns, input.locale as NumberLocale);
    const pathname = normalizedStoragePath(projectId, row.id);
    await storage().put(pathname, normalized.body);
    await getPrisma().campaignDataImport.update({
      where: { id: row.id },
      data: {
        status: "READY",
        normalizedStoragePath: pathname,
        columnMapping: { columns },
        numberLocale: input.locale as NumberLocale,
        currency: input.currency as CampaignCurrency,
        rowCount: normalized.rowCount,
        availableDimensions: normalized.dimensions,
        availableMetrics: normalized.metrics,
        warnings: [...(Array.isArray(row.warnings) ? row.warnings.filter((item): item is string => typeof item === "string") : []), ...normalized.warnings],
        parsedAt: new Date(),
        failureCode: null,
      },
    });
    logSafe({ importId: row.id, projectId, status: "READY", sizeBytes: bytes.byteLength, rowCount: normalized.rowCount });
    return { ok: true, status: "READY" };
  } catch (error) {
    const code = error instanceof CampaignDataError ? error.code : "PARSE_FAILED";
    await getPrisma().campaignDataImport.update({ where: { id: row.id }, data: { status: "FAILED", failureCode: code } });
    logSafe({ importId: row.id, projectId, status: "FAILED", code });
    return fail(code);
  }
}

export async function deleteCampaignImport(userId: string, projectId: string, importId: string): Promise<Result<{ status: "DELETED" }>> {
  const row = await ownedImport(userId, projectId, importId);
  if (!row) return fail("NOT_FOUND");
  if (row.status === "DELETED") return { ok: true, status: "DELETED" };
  try {
    await deletePrivateObjects(storage(), [row.rawStoragePath, row.normalizedStoragePath]);
  } catch (error) {
    const code = error instanceof CampaignDataError ? error.code : "STORAGE_FAILED";
    logSafe({ importId: row.id, projectId, status: row.status, code });
    return fail(code);
  }
  await getPrisma().campaignDataImport.update({
    where: { id: row.id },
    data: {
      status: "DELETED",
      deletedAt: new Date(),
      originalFileName: null,
      mimeType: null,
      rawStoragePath: "",
      normalizedStoragePath: null,
      sheetNames: Prisma.DbNull,
      selectedSheet: null,
      columnMapping: Prisma.DbNull,
      warnings: Prisma.DbNull,
      availableDimensions: Prisma.DbNull,
      availableMetrics: Prisma.DbNull,
    },
  });
  logSafe({ importId: row.id, projectId, status: "DELETED" });
  return { ok: true, status: "DELETED" };
}

export async function listCampaignImports(userId: string, projectId: string) {
  const project = await getPrisma().project.findFirst({ where: ownedProject(userId, projectId), select: { id: true, name: true, status: true } });
  if (!project) return null;
  const imports = await getPrisma().campaignDataImport.findMany({
    where: { projectId, userId, status: { not: "DELETED" } },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      originalFileName: true,
      sourcePlatform: true,
      fileFormat: true,
      status: true,
      rowCount: true,
      columnCount: true,
      createdAt: true,
      failureCode: true,
    },
  });
  return { project, imports };
}

export async function campaignImportDetail(userId: string, projectId: string, importId: string) {
  const row = await ownedImport(userId, projectId, importId);
  if (!row || row.status === "DELETED") return null;
  const draft = draftOf(row.columnMapping);
  let preview: { headers: string[]; rows: string[][] } | null = null;
  if (row.status === "NEEDS_MAPPING" || row.status === "READY") {
    try {
      const bytes = await storage().get(row.rawStoragePath);
      if (bytes) {
        const workbook = await inspectBytes(bytes, row.selectedSheet ?? undefined);
        const sheet = activeSheet(workbook, row.selectedSheet ?? undefined);
        if (sheet) preview = { headers: sheet.headers, rows: sheet.rows.slice(0, CAMPAIGN_DATA_LIMITS.previewRows) };
      }
    } catch {
      preview = null;
    }
  }
  return {
    id: row.id,
    status: row.status,
    fileFormat: row.fileFormat,
    sourcePlatform: row.sourcePlatform,
    originalFileName: row.originalFileName,
    sheetNames: Array.isArray(row.sheetNames) ? row.sheetNames.filter((item): item is string => typeof item === "string") : [],
    selectedSheet: row.selectedSheet,
    suggestions: draft?.suggestions ?? [],
    headers: draft?.headers ?? preview?.headers ?? [],
    preview,
    availableMetrics: row.availableMetrics,
    availableDimensions: row.availableDimensions,
    warnings: Array.isArray(row.warnings) ? row.warnings.filter((item): item is string => typeof item === "string") : [],
    failureCode: row.failureCode,
    numberLocale: row.numberLocale,
    currency: row.currency,
  };
}
