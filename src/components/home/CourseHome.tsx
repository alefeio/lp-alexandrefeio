import Link from "next/link";
import { AcquisitionLink } from "@/components/analytics/AcquisitionLink";
import { Container } from "@/components/ui/Container";
import { aboutContent } from "@/data/home";
import { buttonClass } from "@/lib/button-styles";
import { formatPriceCents } from "@/lib/learning/money";

const COURSE_PATH = "/cursos/trafego-pago-na-pratica";
const FREE_ANCHOR = `${COURSE_PATH}#aulas-gratuitas`;

const builds = [
  { title: "Meu primeiro mapa de tráfego", lesson: "Aula 1", href: "/aulas/como-funciona-o-trafego-pago" },
  { title: "Minha indicação inicial de canal", lesson: "Aula 2", href: "/aulas/google-ads-ou-meta-ads" },
  { title: "Diagnóstico de Prontidão", lesson: "Aula 3", href: "/aulas/negocio-pronto-para-anunciar" },
  { title: "Brief Inicial de Campanha", lesson: "Aula 4", href: "/aulas/objetivo-oferta-orcamento" },
  { title: "Plano de Destino e Mensuração", lesson: "Aula 5", href: "/aulas/destino-e-mensuracao" },
  { title: "Blueprint de Campanha de Pesquisa", lesson: "Aula 6", href: "/aulas/campanha-de-pesquisa" },
] as const;

type HomeLesson = {
  slug: string;
  title: string;
  summary: string;
  estimatedMinutes: number | null;
  accessType: "FREE" | "PAID";
};

export function CourseHome({
  courseTitle,
  coursePriceCents,
  freeLessons,
}: {
  courseTitle: string;
  coursePriceCents: number | null;
  freeLessons: HomeLesson[];
}) {
  return (
    <>
      <section className="hero-stage final-stage py-14 text-on-ink sm:py-16 lg:py-20">
        <Container>
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-on-ink">Alexandre Feio</p>
          <h1 className="mt-4 max-w-3xl text-[2.05rem] font-semibold leading-[1.08] tracking-tight text-on-ink sm:text-5xl">
            Aprenda tráfego pago aplicando no seu próprio negócio.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-on-ink-muted sm:text-lg">
            Uma trilha em texto para planejar, executar e medir. Se preferir delegar, eu também cuido da estratégia e da gestão.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <AcquisitionLink className={buttonClass("inverted")} href={FREE_ANCHOR} event="course_cta_click" payload={{ course_slug: "trafego-pago-na-pratica", cta_name: "comecar_gratuitamente" }}>
              Começar gratuitamente
            </AcquisitionLink>
            <Link className={`${buttonClass("secondary")} border-white/20 bg-transparent text-on-ink hover:bg-white/10`} href="/trafego-pago">
              Prefiro contratar a gestão
            </Link>
          </div>
        </Container>
      </section>

      <section id="nao-e-so-assistir" className="scroll-mt-24 py-16">
        <Container className="max-w-3xl">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Não é só assistir</h2>
          <p className="mt-4 text-base leading-relaxed">
            Cada aula pede uma decisão sobre o seu negócio. O que você responde fica salvo no seu projeto: mapa, diagnóstico, brief, plano e estrutura de campanha.
          </p>
        </Container>
      </section>

      <section className="border-t border-border py-16">
        <Container>
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Três aulas gratuitas</h2>
          <p className="mt-3 max-w-2xl text-base leading-relaxed text-muted">
            Comece sem conta. O texto completo das três primeiras aulas está aberto.
          </p>
          <ol className="mt-8 grid gap-4 md:grid-cols-3">
            {freeLessons.map((lesson, index) => (
              <li key={lesson.slug} className="rounded-lg border border-border bg-surface p-5">
                <p className="text-xs font-medium uppercase tracking-[0.14em] text-cta">Aula {index + 1} · gratuita</p>
                <h3 className="mt-3 text-lg font-medium">{lesson.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{lesson.summary}</p>
                <p className="mt-4 text-sm text-muted">{lesson.estimatedMinutes ? `${lesson.estimatedMinutes} min` : "Leitura"}</p>
                <AcquisitionLink className="mt-4 inline-flex text-sm font-medium underline underline-offset-4" href={`/aulas/${lesson.slug}`} event="course_free_start" payload={{ course_slug: "trafego-pago-na-pratica", lesson_slug: lesson.slug, cta_name: "comecar_aula" }}>
                  Começar aula
                </AcquisitionLink>
              </li>
            ))}
          </ol>
        </Container>
      </section>

      <section id="o-que-voce-constroi" className="scroll-mt-24 border-t border-border py-16">
        <Container>
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">O que você constrói</h2>
          <ul className="mt-8 grid gap-3 sm:grid-cols-2">
            {builds.map((item) => (
              <li key={item.href} className="rounded-lg border border-border p-4">
                <p className="text-xs text-muted">{item.lesson}</p>
                <Link className="mt-1 inline-flex font-medium underline underline-offset-4" href={item.href}>
                  {item.title}
                </Link>
              </li>
            ))}
          </ul>
          <p className="mt-6 max-w-2xl text-sm leading-relaxed text-muted">
            As aulas seguintes do programa — palavras-chave, anúncios, Meta Ads e leitura de números — ainda estão em preparação. Elas não têm ferramenta pronta nesta versão.
          </p>
        </Container>
      </section>

      <section id="curso" className="scroll-mt-24 border-t border-border py-16">
        <Container className="max-w-3xl">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">{courseTitle}</h2>
          <p className="mt-4 text-base leading-relaxed">
            Cinco módulos e doze aulas. Três estão abertas. As aulas pagas publicadas mostram uma amostra real; a compra ainda não está aberta.
          </p>
          {coursePriceCents != null ? (
            <p className="mt-4 text-sm text-muted">Curso completo: {formatPriceCents(coursePriceCents)}. Disponível em breve.</p>
          ) : null}
          <p className="mt-6">
            <Link className={buttonClass("primary")} href={COURSE_PATH}>
              Ver o curso
            </Link>
          </p>
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

      <section id="sobre" className="scroll-mt-24 border-t border-border py-16">
        <Container className="max-w-3xl">
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-cta">{aboutContent.eyebrow}</p>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">{aboutContent.title}</h2>
          <p className="mt-4 text-base leading-relaxed">{aboutContent.description}</p>
          <p className="mt-4 text-sm leading-relaxed text-muted">
            O conteúdo do curso é escrito por mim, a partir de desenvolvimento, tecnologia, tráfego pago e marketing.
          </p>
        </Container>
      </section>

      <section id="servico" className="scroll-mt-24 border-t border-border py-16">
        <Container className="max-w-3xl">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Prefere delegar?</h2>
          <p className="mt-4 text-base leading-relaxed">
            Além do curso, eu faço a gestão de tráfego pago, a estrutura de conversão, a mensuração e, quando precisa, a landing page.
          </p>
          <p className="mt-6">
            <AcquisitionLink className={buttonClass("secondary")} href="/trafego-pago" event="service_from_course_click" payload={{ course_slug: "trafego-pago-na-pratica", cta_name: "conhecer_servico" }}>
              Conhecer o serviço
            </AcquisitionLink>
          </p>
        </Container>
      </section>

      <section className="border-t border-border py-16">
        <Container className="max-w-3xl">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Comece pelas aulas abertas</h2>
          <p className="mt-4 text-base leading-relaxed">O primeiro passo é aplicar o mapa, a escolha de canal e o diagnóstico no seu negócio.</p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <AcquisitionLink className={buttonClass("primary")} href={FREE_ANCHOR} event="course_cta_click" payload={{ course_slug: "trafego-pago-na-pratica", cta_name: "comecar_gratuitamente" }}>
              Começar gratuitamente
            </AcquisitionLink>
            <Link className={buttonClass("secondary")} href="/trafego-pago">
              Prefiro contratar a gestão
            </Link>
          </div>
        </Container>
      </section>
    </>
  );
}
