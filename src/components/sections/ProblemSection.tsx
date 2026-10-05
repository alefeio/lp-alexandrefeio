import { problemContent } from "@/data/home";
import { cn } from "@/lib/cn";
import { Container } from "@/components/ui/Container";
import { Section } from "@/components/ui/Section";

export function ProblemSection() {
  return (
    <Section id="problema" titleId="problema-titulo">
      <Container>
        <div className="max-w-2xl">
          <h2 id="problema-titulo" className="text-[1.85rem] font-semibold leading-[1.15] tracking-tight sm:text-4xl">
            {problemContent.title}
          </h2>
          <p className="mt-4 text-base leading-relaxed text-muted sm:text-lg">{problemContent.description}</p>
        </div>

        <ol className="mt-10 grid gap-8 md:mt-12 md:grid-cols-12 md:gap-x-8">
          {problemContent.items.map((item, index) => (
            <li
              key={item}
              className={cn("border-t pt-5", index === 0 ? "border-cta md:col-span-6" : "border-border md:col-span-3")}
            >
              <span className={cn("font-mono text-sm", index === 0 ? "text-cta" : "text-subtle")}>
                0{index + 1}
              </span>
              <p
                className={cn(
                  "mt-3 leading-snug",
                  index === 0 ? "max-w-md text-xl font-semibold tracking-tight" : "text-base font-medium",
                )}
              >
                {item}
              </p>
            </li>
          ))}
        </ol>
      </Container>
    </Section>
  );
}
