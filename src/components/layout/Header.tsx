import Link from "next/link";
import { navigation } from "@/data/navigation";
import { siteConfig } from "@/data/site-config";
import { ContactLink } from "@/components/ui/ContactLink";
import { Container } from "@/components/ui/Container";
import { Wordmark } from "@/components/ui/Wordmark";
import { AccountNav } from "@/components/layout/AccountNav";
import { MobileNav } from "@/components/layout/MobileNav";
import { getSession } from "@/lib/auth/session";

export async function Header() {
  const session = await getSession();
  const signedIn = Boolean(session);
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

          <div className="hidden items-center gap-3 lg:flex">
            <AccountNav signedIn={signedIn} source="public_header" />
            <ContactLink location="header" variant="secondary">{siteConfig.ctas.primary}</ContactLink>
          </div>

          <MobileNav signedIn={signedIn} />
        </div>
      </Container>
    </header>
  );
}
