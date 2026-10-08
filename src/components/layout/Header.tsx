import Link from "next/link";
import { navigation } from "@/data/navigation";
import { siteConfig } from "@/data/site-config";
import { ContactLink } from "@/components/ui/ContactLink";
import { Container } from "@/components/ui/Container";
import { Wordmark } from "@/components/ui/Wordmark";
import { MobileNav } from "@/components/layout/MobileNav";

export function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/80 bg-background/80 backdrop-blur-md">
      <Container>
        <div className="flex h-16 items-center justify-between gap-4">
          <Link href="/" className="min-w-0 text-[1.05rem] text-foreground">
            <Wordmark />
          </Link>

          <nav className="hidden items-center gap-6 lg:flex" aria-label="Principal">
            {navigation.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="text-sm text-muted transition-colors duration-200 hover:text-foreground"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="hidden lg:block">
            <ContactLink location="header">{siteConfig.ctas.primary}</ContactLink>
          </div>

          <MobileNav />
        </div>

        <div className="pb-3 lg:hidden">
          <ContactLink location="header_mobile" className="w-full">
            {siteConfig.ctas.primary}
          </ContactLink>
        </div>
      </Container>
    </header>
  );
}
