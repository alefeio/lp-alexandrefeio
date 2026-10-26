import { Container } from "@/components/ui/Container";

export function CourseOutcome({
  headline,
  transformation,
  steps,
}: {
  headline: string;
  transformation: string;
  steps: string[];
}) {
  return (
    <section className="overflow-x-clip py-16">
      <Container className="max-w-3xl">
        <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">{headline}</h2>
        <p className="mt-4 text-base leading-relaxed">{transformation}</p>
        <ol className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          {steps.map((step, index) => (
            <li key={step} className="flex min-w-0 items-center gap-3">
              <span className="rounded-full border border-border bg-surface px-3 py-1.5 text-sm font-medium">{step}</span>
              {index < steps.length - 1 ? <span className="hidden text-muted sm:inline" aria-hidden>→</span> : null}
            </li>
          ))}
        </ol>
      </Container>
    </section>
  );
}
