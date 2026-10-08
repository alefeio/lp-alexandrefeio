import Link from "next/link";
import { footerNavigation } from "@/data/navigation";
import { siteConfig } from "@/data/site-config";
import { Container } from "@/components/ui/Container";
import { CookiePreferencesLink } from "@/components/ui/CookiePreferencesLink";
import { TrackedWhatsAppLink } from "@/components/ui/TrackedWhatsAppLink";
import { Wordmark } from "@/components/ui/Wordmark";
import { buildWhatsAppUrl, emailHref, instagramHref } from "@/lib/contact";

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
          aria-label={`${label}: ${value}`}
          className="text-foreground underline-offset-4 transition-colors duration-200 hover:text-cta hover:underline"
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

  return (
    <footer className="border-t border-border py-10">
      <Container className="grid gap-8 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,0.7fr)_minmax(0,1fr)]">
        <div>
          <Wordmark className="text-base" />
          <p className="mt-2 text-sm text-muted">{siteConfig.location.short}</p>
          <p className="mt-3 max-w-xs text-sm leading-relaxed text-muted">
            Tráfego pago e estrutura de conversão.
          </p>
        </div>

        <nav aria-label="Rodapé">
          <ul className="flex flex-col gap-2">
            {footerNavigation.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="text-sm text-foreground transition-colors duration-200 hover:text-cta">
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div>
          <p className="text-sm font-semibold">Contato</p>
          <div className="mt-2 flex flex-col gap-1">
            {whatsappHref ? (
              <p className="text-sm leading-6">
                <span className="text-muted">WhatsApp: </span>
                <TrackedWhatsAppLink
                  href={whatsappHref}
                  location="footer_whatsapp"
                  label={`WhatsApp: ${siteConfig.contact.whatsapp}`}
                  className="text-foreground underline-offset-4 transition-colors duration-200 hover:text-cta hover:underline"
                >
                  {siteConfig.contact.whatsapp}
                </TrackedWhatsAppLink>
              </p>
            ) : null}
            {mailHref ? <ContactLine label="E-mail" value={siteConfig.contact.email} href={mailHref} /> : null}
            {instagram ? (
              <ContactLine label="Instagram" value={siteConfig.contact.instagram} href={instagram} />
            ) : null}
            <a href="#contato" className="mt-1 text-sm text-foreground transition-colors duration-200 hover:text-cta">
              {siteConfig.ctas.final}
            </a>
          </div>
        </div>
      </Container>

      <Container className="mt-8 border-t border-border pt-5">
        <p className="text-sm text-subtle">
          © {year} {siteConfig.name}. {siteConfig.location.short}.{" "}
          <Link href="/privacidade" className="text-foreground underline-offset-4 hover:underline">
            Privacidade
          </Link>
          . <CookiePreferencesLink />.
        </p>
        {process.env.NODE_ENV === "development" ? (
          <p className="mt-3 max-w-xl text-xs leading-relaxed text-subtle">
            Cases mockados não são exibidos como prova.
          </p>
        ) : null}
      </Container>
    </footer>
  );
}
