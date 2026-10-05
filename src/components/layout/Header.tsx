import { navigation } from "@/data/navigation";
import { siteConfig } from "@/data/site-config";
import { ContactLink } from "@/components/ui/ContactLink";
import { Container } from "@/components/ui/Container";
import { MobileNav } from "@/components/layout/MobileNav";

export function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background">
      <Container>
        <div className="flex h-16 items-center justify-between gap-4">
          <a href="#topo" className="min-w-0 truncate text-[15px] font-semibold tracking-tight">
            {siteConfig.name}
          </a>

          <nav className="hidden items-center gap-5 lg:flex" aria-label="Principal">
            {navigation.map((item) => (
              <a key={item.href} href={item.href} className="text-sm text-muted hover:text-foreground">
                {item.label}
              </a>
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
