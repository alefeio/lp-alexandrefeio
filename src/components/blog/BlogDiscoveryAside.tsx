import { BlogCtaLink } from "@/components/blog/BlogCtaLink";
import { blogIndexClickParams } from "@/lib/blog/clicks";
import { buttonClass } from "@/lib/button-styles";

export function BlogDiscoveryAside() {
  return (
    <aside className="min-w-0 space-y-5 lg:sticky lg:top-24" aria-label="Aprender e delegar">
      <section className="rounded-2xl border border-border bg-surface p-5 sm:p-6">
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-cta">Aprender</p>
        <h2 className="mt-3 text-lg font-semibold tracking-tight">Formações práticas</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Aprenda a atrair as pessoas certas, construir a página e decidir o próximo passo com os seus próprios dados.
        </p>
        <p className="mt-5">
          <BlogCtaLink href="/cursos" className={buttonClass("primary", "w-full sm:w-auto")} event="cta_click" params={blogIndexClickParams("courses")}>
            Ver as formações
          </BlogCtaLink>
        </p>
      </section>
      <section className="rounded-2xl border border-border bg-surface p-5 sm:p-6">
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-cta">Delegar</p>
        <h2 className="mt-3 text-lg font-semibold tracking-tight">Gestão profissional</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Campanhas, destino e mensuração no mesmo plano, quando você prefere executar com suporte estratégico.
        </p>
        <p className="mt-5">
          <BlogCtaLink
            className={buttonClass("secondary", "w-full sm:w-auto")}
            href="/trafego-pago"
            event="service_from_course_click"
            params={blogIndexClickParams("service")}
          >
            Conhecer a gestão
          </BlogCtaLink>
        </p>
      </section>
    </aside>
  );
}
