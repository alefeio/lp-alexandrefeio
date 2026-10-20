import Link from "next/link";
import { AcquisitionLink } from "@/components/analytics/AcquisitionLink";
import { ViewEvent } from "@/components/analytics/ViewEvent";
import { AddToCartButton } from "@/components/commerce/AddToCartButton";
import { JsonLd } from "@/components/seo/JsonLd";
import { Container } from "@/components/ui/Container";
import { aboutContent } from "@/data/home";
import { buttonClass } from "@/lib/button-styles";
import { isCommerceEnabled, isProductForSale } from "@/lib/commerce/config";
import { paidLessonAction } from "@/lib/commerce/sale-action";
import { formatPriceCents } from "@/lib/learning/money";
import { breadcrumbList, courseJsonLd } from "@/lib/seo/learning-jsonld";

type SalesLesson = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  estimatedMinutes: number | null;
  accessType: "FREE" | "PAID";
  commerceStatus: "NOT_FOR_SALE" | "AVAILABLE";
  priceCents: number | null;
  hasPublicPreview: boolean;
};

type SalesModule = {
  id: string;
  title: string;
  description: string;
  bundlePriceCents: number | null;
  commerceStatus: "NOT_FOR_SALE" | "AVAILABLE";
  lessons: SalesLesson[];
};

const FULL_COURSE_BENEFITS = [
  "Planejamento de campanha",
  "Google Ads",
  "Meta Ads",
  "Ferramentas práticas",
  "Diagnóstico dos resultados",
  "Análise de CSV/XLSX",
  "Plano de próxima ação",
] as const;

export function CourseSales({
  course,
  ownedLessonIds = [],
}: {
  ownedLessonIds?: string[];
  course: {
    id: string;
    slug: string;
    title: string;
    subtitle: string | null;
    description: string;
    bundlePriceCents: number | null;
    commerceStatus: "NOT_FOR_SALE" | "AVAILABLE";
    modules: SalesModule[];
  };
}) {
  const commerce = isCommerceEnabled();
  const courseOpen = isProductForSale(course.commerceStatus, course.bundlePriceCents);
  const owned = new Set(ownedLessonIds);
  const allLessons = course.modules.flatMap((moduleRow) => moduleRow.lessons);
  const paidLessons = allLessons.filter((lesson) => lesson.accessType === "PAID");
  const freeLessons = allLessons.filter((lesson) => lesson.accessType === "FREE");
  const ownsAllPaid = paidLessons.length > 0 && paidLessons.every((lesson) => owned.has(lesson.id));
  const hasPartialPurchase = ownedLessonIds.length > 0 && !ownsAllPaid;
  const individualTotalCents = paidLessons.reduce((sum, lesson) => sum + (lesson.priceCents ?? 0), 0);
  const savingsCents =
    course.bundlePriceCents != null && individualTotalCents > course.bundlePriceCents
      ? individualTotalCents - course.bundlePriceCents
      : 0;
  const salesOpen = course.modules.some(
    (moduleRow) =>
      isProductForSale(moduleRow.commerceStatus, moduleRow.bundlePriceCents, commerce) ||
      moduleRow.lessons.some((lesson) => lesson.accessType === "PAID" && isProductForSale(lesson.commerceStatus, lesson.priceCents, commerce)),
  );

  return (
    <>
      <ViewEvent event="course_view" slug={course.slug} courseSlug={course.slug} />
      <JsonLd data={courseJsonLd({ title: course.title, description: course.description, path: `/cursos/${course.slug}` })} />
      <JsonLd
        data={breadcrumbList([
          { name: "Cursos", path: "/cursos" },
          { name: course.title, path: `/cursos/${course.slug}` },
        ])}
      />
      <section className="hero-stage final-stage py-14 text-on-ink sm:py-16">
        <Container className="max-w-3xl">
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-on-ink">Curso · 3 aulas gratuitas</p>
          <h1 className="mt-4 text-[2rem] font-semibold leading-[1.1] tracking-tight text-on-ink sm:text-5xl">{course.title}</h1>
          <p className="mt-5 text-base leading-relaxed text-on-ink-muted sm:text-lg">
            Aprenda, aplique no seu negócio e salve o diagnóstico e as ferramentas no seu projeto.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            {ownsAllPaid ? (
              <Link className={buttonClass("inverted")} href="/app/aprendizado">
                Continuar curso
              </Link>
            ) : (
              <>
                <AcquisitionLink className={buttonClass("inverted")} href="#aulas-gratuitas" event="course_free_start" payload={{ course_slug: course.slug, cta_name: "aulas_gratuitas" }}>
                  Começar pelas aulas gratuitas
                </AcquisitionLink>
                {courseOpen ? (
                  <AcquisitionLink
                    className={buttonClass("secondary", "border-white/30 bg-transparent text-on-ink hover:bg-white/10")}
                    href="#curso-completo"
                    event="course_cta_click"
                    payload={{ course_slug: course.slug, cta_name: "curso_completo_hero" }}
                  >
                    {`Curso completo — ${formatPriceCents(course.bundlePriceCents ?? 0)}`}
                  </AcquisitionLink>
                ) : null}
              </>
            )}
          </div>
        </Container>
      </section>

      <section className="py-16">
        <Container className="max-w-3xl space-y-10">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Para quem é</h2>
            <p className="mt-3 text-base leading-relaxed">
              Para quem toca um pequeno negócio e quer entender tráfego pago o bastante para decidir canal, oferta, destino e a primeira campanha — antes de abrir a plataforma de anúncios.
            </p>
          </div>
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">O que você aprende</h2>
            <p className="mt-3 text-base leading-relaxed">
              Como o anúncio chega numa pessoa, quando Google ou Meta faz mais sentido, se o negócio está pronto para anunciar, como planejar oferta e mensuração, configurar a primeira campanha, ler os números e decidir a próxima ação com critério.
            </p>
          </div>
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Como funciona</h2>
            <p className="mt-3 text-base leading-relaxed">
              As aulas são texto. Você lê, responde e, nas ferramentas, grava o resultado no projeto. A ordem é sugerida. Nenhuma aula trava a seguinte.
            </p>
          </div>
        </Container>
      </section>

      <section id="aulas-gratuitas" className="scroll-mt-24 border-t border-border py-16">
        <Container>
          <h2 className="text-2xl font-semibold tracking-tight">Três aulas gratuitas</h2>
          <ol className="mt-6 grid gap-4 md:grid-cols-3">
            {freeLessons.map((lesson) => (
              <li key={lesson.id} className="rounded-lg border border-border p-5">
                <h3 className="text-lg font-medium">{lesson.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{lesson.summary}</p>
                <p className="mt-3 text-sm text-muted">{lesson.estimatedMinutes ? `${lesson.estimatedMinutes} min` : null}</p>
                <AcquisitionLink className={`${buttonClass("primary")} mt-4`} href={`/aulas/${lesson.slug}`} event="course_free_start" payload={{ course_slug: course.slug, lesson_slug: lesson.slug, cta_name: "comecar_aula" }}>
                  Começar aula
                </AcquisitionLink>
              </li>
            ))}
          </ol>
        </Container>
      </section>

      <section id="curso-completo" className="scroll-mt-24 border-t border-border bg-[linear-gradient(180deg,#f7f9fc_0%,#ffffff_72%)] py-16">
        <Container className="max-w-3xl">
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-cta">Oferta principal</p>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">Faça a jornada completa</h2>
          <p className="mt-3 text-base leading-relaxed text-muted">Do primeiro planejamento até a análise dos seus próprios resultados.</p>

          <div className="mt-8 rounded-2xl border border-cta/25 bg-surface p-6 shadow-[0_24px_48px_-36px_rgba(11,18,32,0.55)] sm:p-8">
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-cta">Curso completo</p>
            <h3 className="mt-3 text-xl font-semibold tracking-tight sm:text-2xl">{course.title}</h3>
            <p className="mt-3 text-sm text-muted">
              {allLessons.length} aulas · {course.modules.length} módulos
            </p>
            <ul className="mt-5 grid gap-2 sm:grid-cols-2">
              {FULL_COURSE_BENEFITS.map((benefit) => (
                <li key={benefit} className="text-sm text-foreground">
                  <span className="mr-2 text-cta" aria-hidden>
                    ✓
                  </span>
                  {benefit}
                </li>
              ))}
            </ul>

            {course.bundlePriceCents != null ? (
              <div className="mt-6 space-y-2 border-t border-border pt-5">
                {individualTotalCents > 0 ? (
                  <p className="text-sm text-muted">
                    Comprando as aulas individualmente: <span className="line-through">{formatPriceCents(individualTotalCents)}</span>
                  </p>
                ) : null}
                <p className="text-lg font-semibold text-foreground">
                  Curso completo: {formatPriceCents(course.bundlePriceCents)}
                  {courseOpen ? "" : " · Disponível em breve."}
                </p>
                {savingsCents > 0 ? (
                  <p className="text-sm text-muted">
                    Economia: {formatPriceCents(savingsCents)}
                    {individualTotalCents > 0 ? ` (cerca de ${Math.round((savingsCents / individualTotalCents) * 100)}%)` : ""}
                  </p>
                ) : null}
              </div>
            ) : null}

            <div className="mt-6">
              {ownsAllPaid ? (
                <Link className={buttonClass("primary")} href="/app/aprendizado">
                  Acessar meu aprendizado
                </Link>
              ) : courseOpen ? (
                <AddToCartButton
                  id={course.id}
                  type="COURSE"
                  label={`Comprar curso completo — ${formatPriceCents(course.bundlePriceCents ?? 0)}`}
                  lessonIds={paidLessons.map((lesson) => lesson.id)}
                />
              ) : (
                <p className="text-sm text-muted">Disponível em breve.</p>
              )}
            </div>
            {hasPartialPurchase && !ownsAllPaid ? (
              <p className="mt-4 text-sm leading-relaxed text-muted">
                Compras anteriores elegíveis viram crédito automaticamente no checkout.
              </p>
            ) : null}
          </div>
        </Container>
      </section>

      <section id="programa" className="scroll-mt-24 border-t border-border py-16">
        <Container className="max-w-3xl">
          <h2 className="text-2xl font-semibold tracking-tight">Prefere avançar por partes?</h2>
          <p className="mt-3 text-base leading-relaxed text-muted">Você também pode adquirir módulos ou aulas individualmente.</p>
          <div className="mt-8 space-y-10">
            {course.modules.map((moduleRow, index) => (
              <section key={moduleRow.id}>
                <h3 className="text-xl font-semibold">
                  Módulo {index + 1} — {moduleRow.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{moduleRow.description}</p>
                <ModulePrice moduleRow={moduleRow} commerce={commerce} />
                <ol className="mt-4 space-y-3">
                  {moduleRow.lessons.map((lesson) => (
                    <LessonRow key={lesson.id} lesson={lesson} courseSlug={course.slug} commerce={commerce} owned={owned.has(lesson.id)} />
                  ))}
                </ol>
              </section>
            ))}
          </div>
        </Container>
      </section>

      <section className="border-t border-border py-16">
        <Container className="max-w-3xl">
          <h2 className="text-2xl font-semibold tracking-tight">Resultados que você guarda</h2>
          <ul className="mt-4 space-y-2 text-base leading-relaxed">
            <li>Meu primeiro mapa de tráfego</li>
            <li>Minha indicação inicial de canal</li>
            <li>Diagnóstico de Prontidão</li>
            <li>Brief Inicial de Campanha</li>
            <li>Plano de Destino e Mensuração</li>
            <li>Blueprint de Campanha de Pesquisa</li>
            <li>Plano inicial de palavras-chave</li>
            <li>Plano de anúncios responsivos</li>
            <li>Plano inicial de campanha Meta</li>
            <li>Plano de geração e atendimento de leads</li>
            <li>Diagnóstico dos resultados da campanha</li>
            <li>Plano de próxima ação</li>
          </ul>
          <p className="mt-4 text-sm leading-relaxed text-muted">
            Nas aulas de análise, você também pode enviar um CSV ou XLSX privado da campanha para diagnosticar gargalos sem expor o arquivo em páginas públicas.
          </p>
        </Container>
      </section>

      <section className="border-t border-border py-16">
        <Container className="max-w-3xl">
          <h2 className="text-2xl font-semibold tracking-tight">Conteúdo por Alexandre Feio</h2>
          <p className="mt-3 text-base leading-relaxed">{aboutContent.description}</p>
          <p className="mt-3 text-sm leading-relaxed text-muted">Desenvolvimento, tecnologia, tráfego pago e marketing. Sem credencial que eu não tenha.</p>
          <p className="mt-4">
            <Link className="text-sm font-medium underline underline-offset-4" href="/#sobre">
              Sobre Alexandre Feio
            </Link>
          </p>
        </Container>
      </section>

      <section className="border-t border-border py-16">
        <Container className="max-w-3xl space-y-6">
          <h2 className="text-2xl font-semibold tracking-tight">Perguntas frequentes</h2>
          <div>
            <h3 className="font-medium">Preciso de conta para as aulas gratuitas?</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted">Não. O texto completo abre sem login. A conta serve para guardar progresso, notas e resultados no projeto.</p>
          </div>
          <div>
            <h3 className="font-medium">Já dá para comprar as aulas pagas?</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              {salesOpen
                ? "Sim. As aulas e os módulos que estão à venda mostram o preço e o botão de compra. O que ainda não foi liberado continua em breve."
                : "Ainda não. As aulas pagas têm uma parte pública para leitura. O restante fica para quando a venda abrir."}
            </p>
          </div>
          <div>
            <h3 className="font-medium">O curso substitui a gestão?</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted">Não. O curso é para quem quer aprender e aplicar. A gestão é para quem prefere que eu conduza a campanha.</p>
          </div>
        </Container>
      </section>

      <section className="border-t border-border py-16">
        <Container className="max-w-3xl">
          <h2 className="text-2xl font-semibold tracking-tight">Prefere delegar?</h2>
          <p className="mt-3 text-base leading-relaxed">
            Eu também faço gestão de tráfego pago, estrutura de conversão, mensuração e landing page quando o anúncio precisa de uma página.
          </p>
          <p className="mt-6">
            <AcquisitionLink className={buttonClass("secondary")} href="/trafego-pago" event="service_from_course_click" payload={{ course_slug: course.slug, cta_name: "conhecer_servico" }}>
              Conhecer o serviço
            </AcquisitionLink>
          </p>
        </Container>
      </section>
    </>
  );
}

function ModulePrice({ moduleRow, commerce }: { moduleRow: SalesModule; commerce: boolean }) {
  if (moduleRow.bundlePriceCents == null) return null;
  const open = isProductForSale(moduleRow.commerceStatus, moduleRow.bundlePriceCents, commerce);
  return (
    <div className="mt-2 text-sm text-muted">
      <p>{`Módulo: ${formatPriceCents(moduleRow.bundlePriceCents)}.${open ? "" : " Disponível em breve."}`}</p>
      {open ? (
        <AddToCartButton
          id={moduleRow.id}
          type="MODULE"
          label={`Ver módulo — ${formatPriceCents(moduleRow.bundlePriceCents)}`}
          lessonIds={moduleRow.lessons.filter((lesson) => lesson.accessType === "PAID").map((lesson) => lesson.id)}
        />
      ) : null}
    </div>
  );
}

function LessonRow({
  lesson,
  courseSlug,
  commerce,
  owned,
}: {
  lesson: SalesLesson;
  courseSlug: string;
  commerce: boolean;
  owned: boolean;
}) {
  const paid = lesson.accessType === "PAID";
  const open = paid && isProductForSale(lesson.commerceStatus, lesson.priceCents, commerce);
  const action = paid ? paidLessonAction({ open, owned }) : null;
  return (
    <li className="rounded-lg border border-border p-4">
      <p className="text-xs text-muted">
        {paid ? "Paga" : "Gratuita"}
        {paid && lesson.priceCents != null ? ` · ${formatPriceCents(lesson.priceCents)}` : ""}
        {lesson.estimatedMinutes ? ` · ${lesson.estimatedMinutes} min` : ""}
        {paid ? ` · ${lesson.commerceStatus === "AVAILABLE" ? "Disponível" : "Não está à venda"}` : ""}
      </p>
      <h4 className="mt-2 font-medium">
        <Link className="underline underline-offset-4" href={`/aulas/${lesson.slug}`}>
          {lesson.title}
        </Link>
      </h4>
      <p className="mt-2 text-sm leading-relaxed text-muted">{lesson.summary}</p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
        {!paid ? (
          <AcquisitionLink className="text-sm font-medium underline underline-offset-4" href={`/aulas/${lesson.slug}`} event="course_free_start" payload={{ course_slug: courseSlug, lesson_slug: lesson.slug, cta_name: "comecar_aula" }}>
            Começar aula
          </AcquisitionLink>
        ) : null}
        {action === "soon" ? <p className="text-sm">Disponível em breve.</p> : null}
        {action === "access" ? (
          <Link className={buttonClass("primary")} href={`/aulas/${lesson.slug}`}>
            Acessar minha aula
          </Link>
        ) : null}
        {action !== "access" && paid && lesson.hasPublicPreview ? (
          <Link className="text-sm underline underline-offset-4" href={`/aulas/${lesson.slug}`}>
            Ler a parte gratuita
          </Link>
        ) : null}
        {action === "buy" && lesson.priceCents != null ? (
          <AddToCartButton id={lesson.id} type="LESSON" label={`Comprar esta aula — ${formatPriceCents(lesson.priceCents)}`} lessonIds={[lesson.id]} />
        ) : null}
      </div>
    </li>
  );
}
