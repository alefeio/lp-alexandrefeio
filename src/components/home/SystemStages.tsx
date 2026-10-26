import { Container } from "@/components/ui/Container";

const stages = [
  { word: "Atrair", line: "Levar a oferta às pessoas certas.", where: "Tráfego Pago" },
  { word: "Converter", line: "Dar clareza e um próximo passo.", where: "Sites que Convertem" },
  { word: "Medir", line: "Saber o que aconteceu.", where: "Os dois cursos" },
  { word: "Melhorar", line: "Decidir o que mudar — ou quando esperar.", where: "Tráfego e a página" },
] as const;

export function SystemStages() {
  return (
    <section className="py-16" aria-label="Da atenção à próxima decisão">
      <Container>
        <h2 className="max-w-2xl text-2xl font-semibold tracking-tight sm:text-3xl">Da atenção à próxima decisão.</h2>
        <ol className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {stages.map((stage, index) => (
            <li key={stage.word} className="min-w-0 rounded-2xl border border-border bg-surface p-5">
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted">
                {index > 0 ? <span aria-hidden>→ </span> : null}
                {String(index + 1).padStart(2, "0")}
              </p>
              <h3 className="mt-3 text-lg font-semibold tracking-tight">{stage.word}</h3>
              <p className="mt-2 text-sm leading-relaxed">{stage.line}</p>
              <p className="mt-4 text-xs font-medium text-cta">{stage.where}</p>
            </li>
          ))}
        </ol>
      </Container>
    </section>
  );
}
