import type { EditorialImageFormat } from "@/lib/storage/image-file";

export type ImageOptimizationReport = {
  originalBytes: number;
  optimizedBytes: number;
  reductionPercent: number;
  width: number;
  height: number;
  format: EditorialImageFormat;
};

export function formatByteSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kilobytes = bytes / 1024;
  const format = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });
  if (kilobytes < 1024) return `${format.format(kilobytes)} KB`;
  return `${format.format(bytes / (1024 * 1024))} MB`;
}

export function imageOptimizationNote(report: Pick<ImageOptimizationReport, "originalBytes" | "optimizedBytes" | "reductionPercent">): string {
  const before = formatByteSize(report.originalBytes);
  const after = formatByteSize(report.optimizedBytes);
  if (report.reductionPercent <= 0) return `${after} mantidos, já em tamanho adequado.`;
  return `${before} → ${after} (${report.reductionPercent}% menor).`;
}
