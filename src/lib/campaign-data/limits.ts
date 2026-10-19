export const CAMPAIGN_DATA_LIMITS = {
  maxFileBytes: 10 * 1024 * 1024,
  maxRows: 50_000,
  maxColumns: 100,
  maxSheets: 10,
  maxHeaderLength: 200,
  maxCellText: 10_000,
  maxZipEntries: 200,
  maxUncompressedBytes: 50 * 1024 * 1024,
  maxContentTypeBytes: 1_000_000,
  uploadGrantMs: 5 * 60 * 1000,
  previewRows: 20,
} as const;
