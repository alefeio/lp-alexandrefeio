import { cn } from "@/lib/cn";
import type { Service } from "@/types/content";
import { ContactLink } from "@/components/ui/ContactLink";

export function ServiceCard({ service, selected }: { service: Service; selected: boolean }) {
  const featured = Boolean(service.featured);

  return (
    <article
      aria-current={selected ? "true" : undefined}
      className={cn(
        "group flex h-full flex-col rounded-2xl p-6 transition-[transform,box-shadow,border-color] duration-200 sm:p-8",
        "motion-safe:hover:-translate-y-0.5 motion-safe:focus-within:-translate-y-0.5",
        featured
          ? "bg-ink text-on-ink shadow-[0_22px_50px_-28px_rgba(11,18,32,0.85)] ring-1 ring-white/10"
          : "border border-border bg-surface text-foreground hover:border-cta/35 hover:shadow-[0_18px_40px_-28px_rgba(15,23,42,0.45)] focus-within:border-cta/35",
        selected && "ring-2 ring-cta ring-offset-2 ring-offset-background",
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "h-px w-8 transition-all duration-200 group-hover:w-14 group-focus-within:w-14",
          featured ? "bg-cta group-hover:bg-cta" : "bg-border group-hover:bg-cta group-focus-within:bg-cta",
        )}
      />

      <div className="mt-5 flex min-h-5 items-center justify-between gap-3">
        {service.tag ? (
          <p className={cn("text-xs font-medium uppercase tracking-[0.14em]", featured ? "text-on-ink" : "text-cta")}>
            {service.tag}
          </p>
        ) : (
          <span />
        )}
        {selected ? (
          <p className={cn("text-xs font-medium", featured ? "text-on-ink" : "text-cta")}>Selecionado</p>
        ) : null}
      </div>

      <h3 className="mt-3 text-2xl font-semibold tracking-tight">{service.name}</h3>
      <p className={cn("mt-3 text-base leading-relaxed", featured ? "text-on-ink-muted" : "text-muted")}>
        {service.description}
      </p>

      <ul className="mt-8 flex-1 space-y-3">
        {service.items.map((item) => (
          <li key={item} className="flex gap-3 text-sm leading-relaxed sm:text-[15px]">
            <span
              aria-hidden="true"
              className={cn(
                "mt-2 size-1.5 shrink-0 rounded-full transition-colors duration-200",
                featured ? "bg-cta" : "bg-cta/70 group-hover:bg-cta",
              )}
            />
            <span>{item}</span>
          </li>
        ))}
      </ul>

      <ContactLink
        location="services"
        serviceId={service.id}
        variant={featured ? "inverted" : "primary"}
        className="mt-8 w-full"
        label={`${service.cta}: ${service.name}`}
      >
        {service.cta}
      </ContactLink>
    </article>
  );
}
