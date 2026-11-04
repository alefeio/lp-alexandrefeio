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

/** Positivo quando o arquivo diminui, negativo quando cresce, zero quando o tamanho é o mesmo. */
export function imageSizeChangePercent(originalBytes: number, optimizedBytes: number): number {
  if (originalBytes <= 0) return 0;
  return Math.round(((originalBytes - optimizedBytes) / originalBytes) * 100);
}

export function imageOptimizationNote(report: Pick<ImageOptimizationReport, "originalBytes" | "optimizedBytes" | "reductionPercent">): string {
  const before = formatByteSize(report.originalBytes);
  const after = formatByteSize(report.optimizedBytes);
  if (report.optimizedBytes < report.originalBytes) {
    return `${before} → ${after} (${sizeChangeLabel(report.originalBytes, report.optimizedBytes, "menor")}).`;
  }
  if (report.optimizedBytes > report.originalBytes) {
    return `${before} → ${after} (${sizeChangeLabel(report.originalBytes, report.optimizedBytes, "maior")}).`;
  }
  return `${after} mantidos, já em tamanho adequado.`;
}

function sizeChangeLabel(originalBytes: number, optimizedBytes: number, direction: "menor" | "maior"): string {
  const percent = Math.abs(imageSizeChangePercent(originalBytes, optimizedBytes));
  if (percent <= 0) return `menos de 1% ${direction}`;
  return `${percent}% ${direction}`;
}
