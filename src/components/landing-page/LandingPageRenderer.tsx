import type { CSSProperties, ReactNode } from "react";
import { LandingPageFormBlock } from "@/components/landing-page/LandingPageFormBlock";
import type { LandingPageSection } from "@/lib/landing-page/components";
import { parseLandingPageDocument } from "@/lib/landing-page/document";
import { visibleLandingPageSections } from "@/lib/landing-page/order";
import { resolveLandingPageAction } from "@/lib/landing-page/action-resolver";
import { mapLandingPageTheme } from "@/lib/landing-page/theme";
import type { LandingPageAction } from "@/lib/landing-page/actions";

export type LandingPageRenderMode = "PREVIEW" | "PUBLIC";

function SectionFrame({
  section,
  children,
}: {
  section: LandingPageSection;
  children: ReactNode;
}) {
  return (
    <section
      id={section.id}
      data-section-id={section.id}
      data-section-type={section.type}
      className="w-full overflow-x-hidden px-4 py-10 sm:px-6 sm:py-14"
    >
      <div className="mx-auto w-full min-w-0" style={{ maxWidth: "var(--lp-content-width)" }}>
        {children}
      </div>
    </section>
  );
}

function ActionControl({
  action,
  mode,
}: {
  action: LandingPageAction;
  mode: LandingPageRenderMode;
}) {
  const resolved = resolveLandingPageAction(action);
  const className = "inline-flex max-w-full break-words rounded-md px-4 py-2 text-sm font-medium";
  const style: CSSProperties = {
    backgroundColor: "var(--lp-primary)",
    color: "var(--lp-background)",
    borderRadius: "var(--lp-radius)",
  };
  if (mode === "PREVIEW" || !resolved) {
    return (
      <button
        type="button"
        className={className}
        style={style}
        data-preview-action="disabled"
        aria-disabled="true"
        data-action-kind={action.type}
      >
        {resolved?.label ?? "Continuar"}
      </button>
    );
  }
  return (
    <a
      className={className}
      style={style}
      href={resolved.href}
      data-action-kind={action.type}
      {...(resolved.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
    >
      {resolved.label}
    </a>
  );
}

function HeroBlock({
  section,
  mode,
  asHeading,
}: {
  section: Extract<LandingPageSection, { type: "HERO" }>;
  mode: LandingPageRenderMode;
  asHeading: "h1" | "h2";
}) {
  const { content } = section;
  const Heading = asHeading;
  return (
    <SectionFrame section={section}>
      {content.eyebrow ? <p className="break-words text-xs font-medium uppercase tracking-[0.14em]">{content.eyebrow}</p> : null}
      <Heading className="mt-3 text-balance break-words text-3xl font-semibold leading-tight tracking-tight sm:text-5xl">
        {content.headline}
      </Heading>
      {content.subheadline ? <p className="mt-4 break-words text-base leading-relaxed sm:text-lg">{content.subheadline}</p> : null}
      {content.primaryCta || content.secondaryCta ? (
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          {content.primaryCta ? <ActionControl action={content.primaryCta} mode={mode} /> : null}
          {content.secondaryCta ? <ActionControl action={content.secondaryCta} mode={mode} /> : null}
        </div>
      ) : null}
    </SectionFrame>
  );
}

function BenefitsBlock({ section }: { section: Extract<LandingPageSection, { type: "BENEFITS" }> }) {
  return (
    <SectionFrame section={section}>
      {section.content.heading ? <h2 className="text-balance break-words text-2xl font-semibold tracking-tight">{section.content.heading}</h2> : null}
      <ul className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
        {section.content.items.map((item) => (
          <li key={item.title} className="min-w-0 rounded-lg border border-current/15 p-4">
            <h3 className="break-words text-lg font-medium">{item.title}</h3>
            <p className="mt-2 break-words text-sm leading-relaxed">{item.description}</p>
          </li>
        ))}
      </ul>
    </SectionFrame>
  );
}

function ProcessBlock({ section }: { section: Extract<LandingPageSection, { type: "PROCESS" }> }) {
  return (
    <SectionFrame section={section}>
      {section.content.heading ? <h2 className="text-balance break-words text-2xl font-semibold tracking-tight">{section.content.heading}</h2> : null}
      <ol className="mt-6 flex flex-col gap-4 md:flex-row md:flex-wrap">
        {section.content.steps.map((step, index) => (
          <li key={`${step.title}-${index}`} className="min-w-0 flex-1 rounded-lg border border-current/15 p-4 md:min-w-48">
            {section.variant === "numbered" ? <p className="text-xs font-medium">{index + 1}</p> : null}
            <h3 className="break-words text-lg font-medium">{step.title}</h3>
            <p className="mt-2 break-words text-sm leading-relaxed">{step.description}</p>
          </li>
        ))}
      </ol>
    </SectionFrame>
  );
}

function TrustBlock({ section }: { section: Extract<LandingPageSection, { type: "TRUST" }> }) {
  const { heading, intro, items } = section.content;
  if (!heading && !intro && items.length === 0) return null;
  return (
    <SectionFrame section={section}>
      {heading ? <h2 className="text-balance break-words text-2xl font-semibold tracking-tight">{heading}</h2> : null}
      {intro ? <p className="mt-3 break-words text-base leading-relaxed">{intro}</p> : null}
      {items.length > 0 ? (
        <ul className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
          {items.map((item) => (
            <li key={item.title} className="min-w-0">
              <h3 className="break-words text-lg font-medium">{item.title}</h3>
              <p className="mt-2 break-words text-sm leading-relaxed">{item.description}</p>
            </li>
          ))}
        </ul>
      ) : null}
    </SectionFrame>
  );
}

function FaqBlock({ section }: { section: Extract<LandingPageSection, { type: "FAQ" }> }) {
  return (
    <SectionFrame section={section}>
      {section.content.heading ? <h2 className="text-balance break-words text-2xl font-semibold tracking-tight">{section.content.heading}</h2> : null}
      <div className="mt-6 space-y-3">
        {section.content.items.map((item) => (
          <details key={item.question} className="rounded-lg border border-current/15 p-4">
            <summary className="cursor-pointer break-words font-medium">{item.question}</summary>
            <p className="mt-3 break-words text-sm leading-relaxed">{item.answer}</p>
          </details>
        ))}
      </div>
    </SectionFrame>
  );
}

function CtaBlock({
  section,
  mode,
}: {
  section: Extract<LandingPageSection, { type: "CTA" }>;
  mode: LandingPageRenderMode;
}) {
  return (
    <SectionFrame section={section}>
      <h2 className="text-balance break-words text-2xl font-semibold tracking-tight">{section.content.heading}</h2>
      {section.content.description ? <p className="mt-3 break-words text-base leading-relaxed">{section.content.description}</p> : null}
      <div className="mt-6">
        <ActionControl action={section.content.action} mode={mode} />
      </div>
    </SectionFrame>
  );
}

function ContactBlock({ section }: { section: Extract<LandingPageSection, { type: "CONTACT" }> }) {
  const { heading, phone, whatsapp, email, addressText } = section.content;
  const rows = [
    phone ? { label: "Telefone", value: phone } : null,
    whatsapp ? { label: "WhatsApp", value: whatsapp } : null,
    email ? { label: "E-mail", value: email } : null,
    addressText ? { label: "Endereço", value: addressText } : null,
  ].filter((row): row is { label: string; value: string } => Boolean(row));
  if (!heading && rows.length === 0) return null;
  return (
    <SectionFrame section={section}>
      {heading ? <h2 className="text-balance break-words text-2xl font-semibold tracking-tight">{heading}</h2> : null}
      <dl className="mt-4 space-y-3">
        {rows.map((row) => (
          <div key={row.label}>
            <dt className="text-xs font-medium uppercase tracking-[0.12em]">{row.label}</dt>
            <dd className="mt-1 break-words text-sm">{row.value}</dd>
          </div>
        ))}
      </dl>
    </SectionFrame>
  );
}

function FooterBlock({
  section,
  mode,
}: {
  section: Extract<LandingPageSection, { type: "FOOTER" }>;
  mode: LandingPageRenderMode;
}) {
  return (
    <SectionFrame section={section}>
      <footer>
        {section.content.brandText ? <p className="break-words text-sm font-medium">{section.content.brandText}</p> : null}
        {section.content.copyrightText ? <p className="mt-2 break-words text-sm">{section.content.copyrightText}</p> : null}
        {section.content.links.length > 0 ? (
          <ul className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            {section.content.links.map((link) => (
              <li key={link.label}>
                <ActionControl action={link.action} mode={mode} />
              </li>
            ))}
          </ul>
        ) : null}
      </footer>
    </SectionFrame>
  );
}

function NarrativeBlock({
  section,
}: {
  section: Extract<LandingPageSection, { type: "PROBLEM" | "SOLUTION" }>;
}) {
  const items = section.content.items ?? [];
  return (
    <SectionFrame section={section}>
      <h2 className="text-balance break-words text-2xl font-semibold tracking-tight">{section.content.heading}</h2>
      {section.content.description ? (
        <p className="mt-3 break-words text-base leading-relaxed">{section.content.description}</p>
      ) : null}
      {items.length > 0 ? (
        <ul className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
          {items.map((item) => (
            <li key={item.title} className="min-w-0 rounded-lg border border-current/15 p-4">
              <h3 className="break-words text-lg font-medium">{item.title}</h3>
              <p className="mt-2 break-words text-sm leading-relaxed">{item.description}</p>
            </li>
          ))}
        </ul>
      ) : null}
    </SectionFrame>
  );
}

function renderSection(
  section: LandingPageSection,
  mode: LandingPageRenderMode,
  heroHeading: "h1" | "h2",
): ReactNode {
  switch (section.type) {
    case "HERO":
      return <HeroBlock section={section} mode={mode} asHeading={heroHeading} />;
    case "PROBLEM":
    case "SOLUTION":
      return <NarrativeBlock section={section} />;
    case "BENEFITS":
      return <BenefitsBlock section={section} />;
    case "PROCESS":
      return <ProcessBlock section={section} />;
    case "TRUST":
      return <TrustBlock section={section} />;
    case "FAQ":
      return <FaqBlock section={section} />;
    case "CTA":
      return <CtaBlock section={section} mode={mode} />;
    case "FORM":
      return (
        <SectionFrame section={section}>
          <LandingPageFormBlock
            sectionId={section.id}
            heading={section.content.heading}
            intro={section.content.intro}
            fields={section.content.fields}
            consentEnabled={section.content.consentEnabled}
            consentText={section.content.consentText}
            submitLabel={section.content.submitLabel}
          />
        </SectionFrame>
      );
    case "CONTACT":
      return <ContactBlock section={section} />;
    case "FOOTER":
      return <FooterBlock section={section} mode={mode} />;
    default: {
      const unreachable: never = section;
      return unreachable;
    }
  }
}

export function LandingPageRenderer({
  document,
  mode,
}: {
  document: unknown;
  mode: LandingPageRenderMode;
}) {
  const parsed = parseLandingPageDocument(document);
  if (!parsed.ok) {
    const code =
      parsed.reason === "UNSUPPORTED_SCHEMA_VERSION" || parsed.reason === "UNSUPPORTED_REGISTRY_VERSION"
        ? parsed.reason
        : "LANDING_PAGE_DOCUMENT_INVALID";
    return (
      <p data-landing-error={code} role="alert" className="px-4 py-8 text-sm">
        Não foi possível exibir esta landing page.
      </p>
    );
  }

  const sections = visibleLandingPageSections(parsed.document.sections);
  let heroCount = 0;

  return (
    <div data-landing-canvas data-render-mode={mode} className="overflow-x-hidden" style={mapLandingPageTheme(parsed.document.theme)}>
      {sections.map((section) => {
        const heroHeading = section.type === "HERO" ? (heroCount++ === 0 ? "h1" : "h2") : "h2";
        const placeholder = mode === "PREVIEW" && section.contentStatus === "PLACEHOLDER";
        return (
          <div key={section.id}>
            {placeholder ? (
              <p data-placeholder-badge className="px-4 pt-4 text-xs text-slate-500">
                Conteúdo provisório
              </p>
            ) : null}
            {renderSection(section, mode, heroHeading)}
          </div>
        );
      })}
    </div>
  );
}
