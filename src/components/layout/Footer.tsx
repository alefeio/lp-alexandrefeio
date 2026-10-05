import { footerNavigation } from "@/data/navigation";
import { siteConfig } from "@/data/site-config";
import { Container } from "@/components/ui/Container";
import { buildWhatsAppUrl, emailHref, instagramHref, isPlaceholder } from "@/lib/contact";

function ContactLine({
  label,
  value,
  href,
}: {
  label: string;
  value: string;
  href: string | null;
}) {
  const external = href?.startsWith("http");

  return (
    <p className="text-sm leading-6">
      <span className="text-muted">{label}: </span>
      {href ? (
        <a
          href={href}
          className="underline-offset-4 hover:underline"
          {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
        >
          {value}
        </a>
      ) : (
        <span>{value}</span>
      )}
    </p>
  );
}

export function Footer() {
  const year = new Date().getFullYear();
  const whatsappHref = buildWhatsAppUrl();
  const mailHref = emailHref();
  const instagram = instagramHref();
  const hasPlaceholder =
    isPlaceholder(siteConfig.contact.whatsapp) ||
    isPlaceholder(siteConfig.contact.email) ||
    isPlaceholder(siteConfig.contact.instagram);

  return (
    <footer className="border-t border-border py-14">
      <Container className="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <p className="font-medium tracking-tight">{siteConfig.name}</p>
          <p className="mt-2 text-sm text-muted">{siteConfig.location.short}</p>
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted">
            Sites e tráfego pago para gerar oportunidades de negócio.
          </p>
        </div>

        <nav aria-label="Rodapé">
          <ul className="flex flex-col gap-2">
            {footerNavigation.map((item) => (
              <li key={item.href}>
                <a href={item.href} className="text-sm text-foreground hover:text-cta">
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium">Contato</p>
          <div className="mt-2 flex flex-col gap-1">
            {whatsappHref ? (
              <ContactLine label="WhatsApp" value={siteConfig.contact.whatsapp} href={whatsappHref} />
            ) : null}
            {mailHref ? <ContactLine label="E-mail" value={siteConfig.contact.email} href={mailHref} /> : null}
            {instagram ? (
              <ContactLine label="Instagram" value={siteConfig.contact.instagram} href={instagram} />
            ) : null}
            <a href="#contato" className="text-sm text-foreground hover:text-cta">
              {siteConfig.ctas.final}
            </a>
          </div>
        </div>
      </Container>

      <Container className="mt-12">
        <p className="text-xs text-subtle">
          © {year} {siteConfig.name}. {siteConfig.location.short}.
        </p>
        {process.env.NODE_ENV === "development" && hasPlaceholder ? (
          <p className="mt-3 max-w-xl text-xs leading-relaxed text-subtle">
            WhatsApp, e-mail e Instagram ainda não estão configurados em src/data/site-config.ts. Métricas do hero e o
            formulário são demonstrativos. Cases mockados não são exibidos como prova.
          </p>
        ) : null}
      </Container>
    </footer>
  );
}
