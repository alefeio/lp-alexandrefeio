import type { ExperienceFindingV1 } from "@/lib/landing-page/experience/schema";

const SEVERITY_LABEL = {
  INFO: "Informação",
  ATTENTION: "Atenção",
  BLOCKER: "Bloqueio",
} as const;

export function FindingCard({ finding }: { finding: ExperienceFindingV1 }) {
  return (
    <article
      className="rounded-lg border border-border p-3"
      data-finding-id={finding.id}
      data-finding-code={finding.code}
      data-finding-source={finding.source}
      data-finding-severity={finding.severity}
      data-finding-status={finding.status}
    >
      <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted">{SEVERITY_LABEL[finding.severity]}</p>
      <p className="mt-2 text-sm">{finding.message}</p>
      <p className="mt-1 text-sm text-muted">{finding.recommendation}</p>
    </article>
  );
}
