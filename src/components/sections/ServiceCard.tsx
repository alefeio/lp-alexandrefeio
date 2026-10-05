import { cn } from "@/lib/cn";
import type { Service } from "@/types/content";
import { ContactLink } from "@/components/ui/ContactLink";

export function ServiceCard({ service, selected }: { service: Service; selected: boolean }) {
  const featured = Boolean(service.featured);

  return (
    <article
      aria-current={selected ? "true" : undefined}
      className={cn(
        "flex h-full flex-col rounded-lg p-6 sm:p-8",
        featured ? "bg-ink text-on-ink" : "border border-border bg-surface text-foreground",
        selected && "ring-2 ring-cta ring-offset-2 ring-offset-background",
      )}
    >
      <div className="flex min-h-5 items-center justify-between gap-3">
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

      <h3 className="mt-4 text-2xl font-medium tracking-tight">{service.name}</h3>
      <p className={cn("mt-3 text-sm leading-relaxed sm:text-base", featured ? "text-on-ink-muted" : "text-muted")}>
        {service.description}
      </p>

      <ul className="mt-8 flex-1 space-y-3">
        {service.items.map((item) => (
          <li key={item} className="flex gap-3 text-sm leading-relaxed">
            <span aria-hidden="true" className={cn("mt-2 size-1 shrink-0 rounded-full", featured ? "bg-on-ink" : "bg-cta")} />
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
