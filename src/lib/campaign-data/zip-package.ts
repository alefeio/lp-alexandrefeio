import { inflateRawSync } from "node:zlib";
import { CampaignDataError } from "@/lib/campaign-data/errors";
import { CAMPAIGN_DATA_LIMITS } from "@/lib/campaign-data/limits";

export type ZipEntry = {
  name: string;
  method: number;
  compressed: Buffer;
  uncompressedSize: number;
};

function readU16(bytes: Uint8Array, offset: number): number {
  return bytes[offset]! | (bytes[offset + 1]! << 8);
}

function readU32(bytes: Uint8Array, offset: number): number {
  return (bytes[offset]! | (bytes[offset + 1]! << 8) | (bytes[offset + 2]! << 16) | (bytes[offset + 3]! << 24)) >>> 0;
}

export function readZipEntries(bytes: Uint8Array): ZipEntry[] {
  const entries: ZipEntry[] = [];
  let offset = 0;
  let uncompressed = 0;
  while (offset + 30 <= bytes.length) {
    const signature = readU32(bytes, offset);
    if (signature !== 0x04034b50) break;
    const flags = readU16(bytes, offset + 6);
    const method = readU16(bytes, offset + 8);
    const compressedSize = readU32(bytes, offset + 18);
    const uncompressedSize = readU32(bytes, offset + 22);
    const nameLength = readU16(bytes, offset + 26);
    const extraLength = readU16(bytes, offset + 28);
    const nameStart = offset + 30;
    const dataStart = nameStart + nameLength + extraLength;
    if (nameStart + nameLength > bytes.length || dataStart + compressedSize > bytes.length) {
      throw new CampaignDataError("INVALID_XLSX");
    }
    if ((flags & 0x1) !== 0 || (flags & 0x8) !== 0 || (method !== 0 && method !== 8)) {
      throw new CampaignDataError("INVALID_XLSX");
    }
    if (uncompressedSize > CAMPAIGN_DATA_LIMITS.maxUncompressedBytes) {
      throw new CampaignDataError("FILE_TOO_LARGE");
    }
    uncompressed += uncompressedSize;
    if (entries.length + 1 > CAMPAIGN_DATA_LIMITS.maxZipEntries || uncompressed > CAMPAIGN_DATA_LIMITS.maxUncompressedBytes) {
      throw new CampaignDataError("FILE_TOO_LARGE");
    }
    const name = Buffer.from(bytes.subarray(nameStart, nameStart + nameLength)).toString("utf8");
    entries.push({
      name,
      method,
      compressed: Buffer.from(bytes.subarray(dataStart, dataStart + compressedSize)),
      uncompressedSize,
    });
    offset = dataStart + compressedSize;
  }
  if (entries.length === 0) throw new CampaignDataError("INVALID_XLSX");
  return entries;
}

export function inflateEntry(entry: ZipEntry): Buffer {
  if (entry.uncompressedSize > CAMPAIGN_DATA_LIMITS.maxContentTypeBytes) {
    throw new CampaignDataError("FILE_TOO_LARGE");
  }
  if (entry.method === 0) return entry.compressed.subarray(0, entry.uncompressedSize);
  const output = inflateRawSync(entry.compressed);
  if (output.length > entry.uncompressedSize && output.length > CAMPAIGN_DATA_LIMITS.maxContentTypeBytes) {
    throw new CampaignDataError("FILE_TOO_LARGE");
  }
  return output;
}

export function assertRealXlsx(entries: ZipEntry[]): { externalLinks: boolean } {
  const names = new Set(entries.map((entry) => entry.name.replaceAll("\\", "/")));
  if ([...names].some((name) => name === "EncryptionInfo" || name === "EncryptedPackage" || name.endsWith("/vbaProject.bin") || name === "xl/vbaProject.bin")) {
    throw new CampaignDataError("INVALID_XLSX");
  }
  const content = entries.find((entry) => entry.name.replaceAll("\\", "/") === "[Content_Types].xml");
  const workbook = names.has("xl/workbook.xml");
  if (!content || !workbook) throw new CampaignDataError("INVALID_XLSX");
  const xml = inflateEntry(content).toString("utf8");
  if (!xml.includes("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml")) {
    throw new CampaignDataError("INVALID_XLSX");
  }
  if (xml.includes("vbaProject")) throw new CampaignDataError("INVALID_XLSX");
  return { externalLinks: [...names].some((name) => name.startsWith("xl/externalLinks/")) };
}
