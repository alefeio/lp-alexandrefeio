import type { ReactNode } from "react";
import Link from "next/link";
import { AcquisitionLink } from "@/components/analytics/AcquisitionLink";
import { Container } from "@/components/ui/Container";
import { aboutContent } from "@/data/home";
import { buttonClass } from "@/lib/button-styles";
import { publicHomeCopy } from "@/lib/home/public-home";

const COURSE_PATH = "/cursos/trafego-pago-na-pratica";
const FIRST_FREE_LESSON = "/aulas/como-funciona-o-trafego-pago";

type HomeLesson = {
  slug: string;
  title: string;
  summary: string;
  estimatedMinutes: number | null;
  accessType: "FREE" | "PAID";
};

export function CourseHome({
  courseTitle,
  lessonCount,
  moduleCount,
  freeLessons,
  continuation = null,
}: {
  courseTitle: string;
  lessonCount: number;
  moduleCount: number;
  freeLessons: HomeLesson[];
  continuation?: ReactNode;
}) {
  const freeCount = freeLessons.length;

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
            <AcquisitionLink className={buttonClass("inverted")} href="/cursos" event="course_cta_click" payload={{ cta_name: "conhecer_os_cursos" }}>
              {publicHomeCopy.primaryCta}
            </AcquisitionLink>
            <Link className={`${buttonClass("secondary")} border-white/20 bg-transparent text-on-ink hover:bg-white/10`} href="/trafego-pago">
              {publicHomeCopy.secondaryCta}
            </Link>
          </div>
        </Container>
      </section>

      {continuation}

      <section id="cursos" className="scroll-mt-24 py-16">
        <Container>
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-cta">Cursos</p>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">Aprenda na prática</h2>
          <p className="mt-3 max-w-2xl text-base leading-relaxed text-muted">
            Cursos feitos para transformar conhecimento em aplicação real no seu negócio.
          </p>

          <article className="mt-8 rounded-2xl border border-border bg-surface p-6 shadow-[0_22px_44px_-36px_rgba(11,18,32,0.5)] sm:p-8">
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-cta">Curso em destaque</p>
            <h3 className="mt-3 text-xl font-semibold tracking-tight sm:text-2xl">{courseTitle}</h3>
            <p className="mt-3 text-sm text-muted">
              {lessonCount} aulas · {moduleCount} módulos
              {freeCount > 0 ? ` · ${freeCount} aulas gratuitas` : ""}
            </p>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted">
              Do planejamento à análise dos resultados, aplicando cada etapa no seu próprio negócio.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <AcquisitionLink
                className={buttonClass("primary")}
                href={COURSE_PATH}
                event="course_cta_click"
                payload={{ course_slug: "trafego-pago-na-pratica", cta_name: "conhecer_o_curso" }}
              >
                Conhecer o curso
              </AcquisitionLink>
              <AcquisitionLink
                className={buttonClass("secondary")}
                href={freeLessons[0] ? `/aulas/${freeLessons[0].slug}` : FIRST_FREE_LESSON}
                event="course_free_start"
                payload={{ course_slug: "trafego-pago-na-pratica", cta_name: "comecar_gratuitamente" }}
              >
                Começar gratuitamente
              </AcquisitionLink>
            </div>
          </article>
        </Container>
      </section>

      {freeCount > 0 ? (
        <section id="comece-gratis" className="scroll-mt-24 border-t border-border py-16">
          <Container>
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Comece gratuitamente</h2>
            <p className="mt-3 max-w-2xl text-base leading-relaxed text-muted">
              Porta de entrada do curso de Tráfego Pago. Três aulas abertas para aplicar no seu negócio sem criar conta.
            </p>
            <ol className="mt-8 grid gap-4 md:grid-cols-3">
              {freeLessons.map((lesson, index) => (
                <li key={lesson.slug} className="rounded-lg border border-border bg-surface p-5">
                  <p className="text-xs font-medium uppercase tracking-[0.14em] text-cta">Aula {index + 1} · gratuita</p>
                  <h3 className="mt-3 text-lg font-medium">{lesson.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted">{lesson.summary}</p>
                  <p className="mt-4 text-sm text-muted">{lesson.estimatedMinutes ? `${lesson.estimatedMinutes} min` : "Leitura"}</p>
                  <AcquisitionLink
                    className="mt-4 inline-flex text-sm font-medium underline underline-offset-4"
                    href={`/aulas/${lesson.slug}`}
                    event="course_free_start"
                    payload={{ course_slug: "trafego-pago-na-pratica", lesson_slug: lesson.slug, cta_name: "comecar_aula" }}
                  >
                    Começar aula
                  </AcquisitionLink>
                </li>
              ))}
            </ol>
          </Container>
        </section>
      ) : null}

      <section id="aprenda-aplicando" className="scroll-mt-24 border-t border-border py-16">
        <Container className="max-w-3xl">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Aprenda aplicando</h2>
          <p className="mt-4 text-base leading-relaxed text-muted">
            Os cursos combinam conteúdo, ferramentas e atividades práticas para você sair com algo construído — não apenas com aulas assistidas.
          </p>
          <ol className="mt-8 grid gap-4 sm:grid-cols-3">
            <li className="rounded-lg border border-border p-5">
              <h3 className="font-medium">Planeje</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">Defina critério, oferta e destino antes de investir.</p>
            </li>
            <li className="rounded-lg border border-border p-5">
              <h3 className="font-medium">Aplique</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">Use ferramentas e decisões no seu próprio projeto.</p>
            </li>
            <li className="rounded-lg border border-border p-5">
              <h3 className="font-medium">Meça</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">Leia o resultado e escolha a próxima ação com base.</p>
            </li>
          </ol>
        </Container>
      </section>

      <section id="como-funciona" className="scroll-mt-24 border-t border-border py-16">
        <Container>
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Como funciona a plataforma</h2>
          <ol className="mt-8 grid gap-4 md:grid-cols-3">
            <li className="rounded-lg border border-border p-5">
              <p className="text-xs font-medium text-cta">1</p>
              <h3 className="mt-2 font-medium">Ler e decidir</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">O texto explica o critério. O checkpoint confirma se a decisão ficou clara.</p>
            </li>
            <li className="rounded-lg border border-border p-5">
              <p className="text-xs font-medium text-cta">2</p>
              <h3 className="mt-2 font-medium">Aplicar no projeto</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">Diagnóstico e ferramentas gravam o resultado no projeto que você escolhe.</p>
            </li>
            <li className="rounded-lg border border-border p-5">
              <p className="text-xs font-medium text-cta">3</p>
              <h3 className="mt-2 font-medium">Retomar de onde parou</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">Progresso, notas e marcações ficam na sua conta quando você entra.</p>
            </li>
          </ol>
        </Container>
      </section>

      <section id="servico" className="scroll-mt-24 border-t border-border py-16">
        <Container className="max-w-3xl">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Prefere delegar?</h2>
          <p className="mt-4 text-base leading-relaxed">
            Cursos são para aprender e aplicar. Se preferir que eu conduza, cuido da gestão de tráfego, da estrutura de conversão, da mensuração e, quando precisa, da landing page.
          </p>
          <p className="mt-6">
            <AcquisitionLink className={buttonClass("secondary")} href="/trafego-pago" event="service_from_course_click" payload={{ cta_name: "conhecer_gestao" }}>
              Conhecer a gestão
            </AcquisitionLink>
          </p>
        </Container>
      </section>

      <section id="sobre" className="scroll-mt-24 border-t border-border py-16">
        <Container className="max-w-3xl">
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-cta">{aboutContent.eyebrow}</p>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">{aboutContent.title}</h2>
          <p className="mt-4 text-base leading-relaxed">{aboutContent.description}</p>
          <p className="mt-4 text-sm leading-relaxed text-muted">
            Trabalho com tecnologia, desenvolvimento, marketing, produto, tráfego e conversão — do aprendizado à execução.
          </p>
        </Container>
      </section>
    </>
  );
}
