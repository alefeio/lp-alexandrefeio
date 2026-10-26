import { SitesPageVisual } from "@/components/course/CourseProductVisual";

const before = ["Google / Meta", "Anúncio"];
const after = ["WhatsApp / formulário", "Lead"];
const close = ["Dados", "Próxima decisão"];

function StepRow({ labels }: { labels: string[] }) {
  return (
    <ol className="grid grid-cols-2 gap-2">
      {labels.map((label) => (
        <li key={label} className="min-w-0 rounded-lg border border-white/15 bg-white px-3 py-2 text-sm font-medium text-ink">
          {label}
        </li>
      ))}
    </ol>
  );
}

export function AcquisitionConversionFlow() {
  return (
    <figure className="min-w-0" aria-label="Fluxo ilustrativo: anúncio, landing page, contato, lead, dados e próxima decisão. Sem métricas de desempenho.">
      <figcaption className="sr-only">
        Demonstração do caminho entre aquisição e conversão. A landing page fica no centro. Não representa um cliente nem um resultado comercial.
      </figcaption>
      <div className="grid min-w-0 gap-2">
        <StepRow labels={before} />
        <span className="mx-auto h-3 w-px bg-white/30" aria-hidden />
        <div className="min-w-0 rounded-2xl bg-white p-3 sm:p-4">
          <SitesPageVisual />
        </div>
        <span className="mx-auto h-3 w-px bg-white/30" aria-hidden />
        <StepRow labels={after} />
        <span className="mx-auto h-3 w-px bg-white/30" aria-hidden />
        <StepRow labels={close} />
      </div>
    </figure>
  );
}
