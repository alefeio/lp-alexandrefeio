import Link from "next/link";
import { buttonClass } from "@/lib/button-styles";
import type { HomeContinuationCard } from "@/lib/home/home-continuation";

export function HomeContinuation({ card }: { card: HomeContinuationCard }) {
  return (
    <section
      aria-label="Continuidade da sua jornada"
      className="border-b border-border bg-surface/80 py-6"
      data-home-continuation={card.kind}
    >
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
        <div className="min-w-0">
          <p className="text-base font-medium text-foreground">{card.greeting}</p>
          <p className="mt-1 text-sm text-muted">{card.line}</p>
          {card.progress ? <p className="mt-1 text-sm text-muted">{card.progress}</p> : null}
        </div>
        <p className="shrink-0">
          <Link className={buttonClass("primary", "w-full sm:w-auto")} href={card.ctaHref}>
            {card.ctaLabel}
          </Link>
        </p>
      </div>
    </section>
  );
}
