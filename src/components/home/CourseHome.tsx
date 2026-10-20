import type { ReactNode } from "react";
import Link from "next/link";
import { AcquisitionLink } from "@/components/analytics/AcquisitionLink";
import { Container } from "@/components/ui/Container";
import { buttonClass } from "@/lib/button-styles";
import { publicHomeCopy } from "@/lib/home/public-home";

const flowSteps = ["Aprenda", "Aplique", "Construa", "Avance"] as const;

export function CourseHome({
  courseTitle,
  courseSlug,
  lessonCount,
  moduleCount,
  freeLessonCount,
  continuation = null,
}: {
  courseTitle: string;
  courseSlug: string;
  lessonCount: number;
  moduleCount: number;
  freeLessonCount: number;
  continuation?: ReactNode;
}) {
  return (
    <>
      <section className="hero-stage final-stage py-14 text-on-ink sm:py-16 lg:py-20">
        <Container>
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-on-ink">Alexandre Feio</p>
          <h1 className="mt-4 max-w-3xl text-[2.05rem] font-semibold leading-[1.08] tracking-tight text-on-ink sm:text-5xl">
            {publicHomeCopy.hero}
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-on-ink-muted sm:text-lg">{publicHomeCopy.support}</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <AcquisitionLink className={buttonClass("inverted")} href="/cursos" event="course_cta_click" payload={{ cta_name: "explorar_os_cursos" }}>
              {publicHomeCopy.primaryCta}
            </AcquisitionLink>
            <Link className={`${buttonClass("secondary")} border-white/20 bg-transparent text-on-ink hover:bg-white/10`} href="/trafego-pago">
              {publicHomeCopy.secondaryCta}
            </Link>
          </div>
        </Container>
      </section>

      {continuation}

      <section className="py-16">
        <Container>
          <h2 className="max-w-2xl text-2xl font-semibold tracking-tight sm:text-3xl">Conhecimento sem aplicação não muda o negócio.</h2>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted">
            Você pode consumir horas de conteúdo e ainda continuar sem saber o que fazer depois. Aqui, o aprendizado é conectado à execução.
          </p>
          <ol className="mt-8 grid gap-4 md:grid-cols-3">
            <li className="rounded-xl border border-border bg-surface p-5">
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-cta">Entenda</p>
              <p className="mt-3 text-base leading-relaxed">Aprenda o critério antes de decidir.</p>
            </li>
            <li className="rounded-xl border border-border bg-surface p-5">
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-cta">Aplique</p>
              <p className="mt-3 text-base leading-relaxed">Use atividades e ferramentas no seu próprio projeto.</p>
            </li>
            <li className="rounded-xl border border-border bg-surface p-5">
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-cta">Avance</p>
              <p className="mt-3 text-base leading-relaxed">Saia de cada etapa com uma próxima ação clara.</p>
            </li>
          </ol>
        </Container>
      </section>

      <section className="border-t border-border bg-[linear-gradient(180deg,#f8fafc_0%,#ffffff_70%)] py-16">
        <Container>
          <h2 className="max-w-2xl text-2xl font-semibold tracking-tight sm:text-3xl">Você não termina uma aula só com anotações.</h2>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted">
            Dependendo do curso, você pode construir planos, diagnósticos, análises e decisões que ficam salvos na sua jornada.
          </p>
          <p className="mt-8 text-sm font-medium text-foreground">Conteúdo + Atividade + Resultado + Próximo passo</p>
          <ol className="mt-4 flex flex-wrap items-center gap-2 sm:gap-3">
            {flowSteps.map((step, index) => (
              <li key={step} className="flex items-center gap-2 sm:gap-3">
                <span className="rounded-lg border border-cta/25 bg-surface px-3 py-2 text-sm font-medium text-foreground">{step}</span>
                {index < flowSteps.length - 1 ? (
                  <span className="text-cta" aria-hidden>
                    →
                  </span>
                ) : null}
              </li>
            ))}
          </ol>
        </Container>
      </section>

      <section id="como-funciona" className="scroll-mt-24 border-t border-border py-16">
        <Container>
          <h2 className="max-w-3xl text-2xl font-semibold tracking-tight sm:text-3xl">Uma plataforma feita para colocar conhecimento em prática.</h2>
          <ol className="mt-8 grid gap-4 sm:grid-cols-2">
            <li className="rounded-xl border border-border p-5">
              <h3 className="font-medium">Aprenda no seu ritmo</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">Conteúdo direto e organizado em etapas.</p>
            </li>
            <li className="rounded-xl border border-border p-5">
              <h3 className="font-medium">Aplique enquanto aprende</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">Atividades e ferramentas transformam teoria em trabalho real.</p>
            </li>
            <li className="rounded-xl border border-border p-5">
              <h3 className="font-medium">Acompanhe seu avanço</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">Progresso, marcos e próximos passos ajudam você a continuar.</p>
            </li>
            <li className="rounded-xl border border-border p-5">
              <h3 className="font-medium">Use no seu negócio</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">O que você constrói fica conectado aos seus projetos.</p>
            </li>
          </ol>
        </Container>
      </section>

      <section id="cursos" className="scroll-mt-24 border-t border-border py-16">
        <Container>
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Escolha onde você quer avançar.</h2>
          <p className="mt-3 max-w-2xl text-base leading-relaxed text-muted">Cursos para transformar conhecimento em execução.</p>

          <article className="mt-8 rounded-2xl border border-border bg-surface p-6 shadow-[0_22px_44px_-36px_rgba(11,18,32,0.5)] sm:p-8">
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-cta">Curso em destaque</p>
            <h3 className="mt-3 text-xl font-semibold tracking-tight sm:text-2xl">{courseTitle}</h3>
            <p className="mt-3 text-sm text-muted">
              {lessonCount} aulas · {moduleCount} módulos
              {freeLessonCount > 0 ? ` · ${freeLessonCount} aulas gratuitas` : ""}
            </p>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted">
              Do planejamento à análise dos resultados, aplicando cada etapa no seu próprio negócio.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <AcquisitionLink
                className={buttonClass("primary")}
                href={`/cursos/${courseSlug}`}
                event="course_cta_click"
                payload={{ course_slug: courseSlug, cta_name: "conhecer_o_curso" }}
              >
                Conhecer o curso
              </AcquisitionLink>
              <Link className={buttonClass("secondary")} href="/cursos">
                Ver todos os cursos
              </Link>
            </div>
          </article>
        </Container>
      </section>

      <section className="border-t border-border py-16">
        <Container>
          <h2 className="max-w-2xl text-2xl font-semibold tracking-tight sm:text-3xl">Menos conteúdo esquecido. Mais coisa feita.</h2>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted">
            Os cursos foram pensados para transformar aprendizado em decisões e entregas úteis para o seu negócio — ao longo das experiências práticas de cada formação.
          </p>
          <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <li className="rounded-xl border border-border p-5">
              <h3 className="font-medium">Decisões mais claras</h3>
            </li>
            <li className="rounded-xl border border-border p-5">
              <h3 className="font-medium">Planos estruturados</h3>
            </li>
            <li className="rounded-xl border border-border p-5">
              <h3 className="font-medium">Diagnósticos</h3>
            </li>
            <li className="rounded-xl border border-border p-5">
              <h3 className="font-medium">Próximos passos</h3>
            </li>
          </ul>
        </Container>
      </section>

      <section className="border-t border-border bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] py-16" aria-label="Exemplo ilustrativo de jornada">
        <Container className="max-w-3xl">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Sua jornada fica visível</h2>
          <p className="mt-3 text-base leading-relaxed text-muted">
            A plataforma acompanha progresso, etapa atual e próximo passo — para você retomar sem perder o fio.
          </p>
          <div className="mt-8 rounded-2xl border border-border bg-surface p-5 sm:p-6">
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-cta">Exemplo ilustrativo</p>
            <p className="mt-4 text-sm font-medium text-foreground">Sua jornada</p>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-border" aria-hidden>
              <div className="h-full w-2/5 rounded-full bg-cta" />
            </div>
            <dl className="mt-5 grid gap-3 sm:grid-cols-2">
              <div>
                <dt className="text-xs text-muted">Etapa atual</dt>
                <dd className="mt-1 text-sm font-medium">Aplicar o que você aprendeu</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Próximo passo</dt>
                <dd className="mt-1 text-sm font-medium">Seguir para a próxima decisão</dd>
              </div>
            </dl>
          </div>
        </Container>
      </section>

      <section className="border-t border-border py-16">
        <Container className="max-w-3xl">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Você pode começar gratuitamente.</h2>
          <p className="mt-4 text-base leading-relaxed text-muted">
            Alguns cursos têm conteúdos gratuitos para você conhecer a experiência antes de comprar.
          </p>
          <p className="mt-6">
            <AcquisitionLink className={buttonClass("primary")} href="/cursos" event="course_cta_click" payload={{ cta_name: "explorar_os_cursos_gratis" }}>
              Explorar os cursos
            </AcquisitionLink>
          </p>
        </Container>
      </section>

      <section id="sobre" className="scroll-mt-24 border-t border-border py-16">
        <Container className="max-w-3xl">
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-cta">Sobre</p>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">Tecnologia, marketing e produto na mesma experiência.</h2>
          <p className="mt-4 text-base leading-relaxed">
            Minha experiência une desenvolvimento, marketing, produto e tráfego. Por isso, os cursos não param na teoria: o objetivo é transformar conhecimento em execução.
          </p>
        </Container>
      </section>

      <section id="servico" className="scroll-mt-24 border-t border-border py-16">
        <Container>
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Você escolhe como avançar.</h2>
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            <article className="rounded-2xl border border-border bg-surface p-6">
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-cta">Quero aprender</p>
              <p className="mt-3 text-base leading-relaxed">Explore os cursos e aplique no seu próprio ritmo.</p>
              <p className="mt-6">
                <AcquisitionLink className={buttonClass("primary")} href="/cursos" event="course_cta_click" payload={{ cta_name: "ver_cursos_escolha" }}>
                  Ver cursos
                </AcquisitionLink>
              </p>
            </article>
            <article className="rounded-2xl border border-border bg-surface p-6">
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-cta">Quero delegar</p>
              <p className="mt-3 text-base leading-relaxed">Conte comigo para cuidar da estratégia de tráfego e conversão.</p>
              <p className="mt-6">
                <AcquisitionLink className={buttonClass("secondary")} href="/trafego-pago" event="service_from_course_click" payload={{ cta_name: "conhecer_gestao" }}>
                  Conhecer a gestão
                </AcquisitionLink>
              </p>
            </article>
          </div>
        </Container>
      </section>

      <section className="border-t border-border py-16">
        <Container className="max-w-3xl">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Pronto para avançar?</h2>
          <p className="mt-4 text-base leading-relaxed text-muted">Escolha um curso prático ou peça ajuda para estruturar sua presença digital.</p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <AcquisitionLink className={buttonClass("primary")} href="/cursos" event="course_cta_click" payload={{ cta_name: "explorar_os_cursos_final" }}>
              Explorar os cursos
            </AcquisitionLink>
            <Link className={buttonClass("secondary")} href="/trafego-pago">
              {publicHomeCopy.finalSecondaryCta}
            </Link>
          </div>
        </Container>
      </section>
    </>
  );
}
