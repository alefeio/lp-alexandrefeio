import { startDiagnosticAction } from "@/lib/diagnostic/actions";
import { buttonClass } from "@/lib/button-styles";

export function StartDiagnosticForm({
  projectId,
  returnTo,
  label,
  variant = "primary",
}: {
  projectId: string;
  returnTo?: string | null;
  label: string;
  variant?: "primary" | "secondary";
}) {
  return (
    <form action={startDiagnosticAction}>
      <input type="hidden" name="projectId" value={projectId} />
      {returnTo ? <input type="hidden" name="returnTo" value={returnTo} /> : null}
      <button className={buttonClass(variant)} type="submit">
        {label}
      </button>
    </form>
  );
}
