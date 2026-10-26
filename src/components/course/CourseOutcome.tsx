import { ProductFlow } from "@/components/course/CourseProductVisual";
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
    <section className="overflow-x-clip py-14 lg:py-16">
      <Container className="max-w-3xl">
        <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">{headline}</h2>
        <p className="mt-4 text-base leading-relaxed">{transformation}</p>
        <div className="mt-8">
          <ProductFlow steps={steps} label="Etapas da formação" />
        </div>
      </Container>
    </section>
  );
}
