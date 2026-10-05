import { cn } from "@/lib/cn";

export function SectionHeading({
  eyebrow,
  title,
  description,
  titleId,
  tone = "light",
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  titleId: string;
  tone?: "light" | "dark";
}) {
  const onDark = tone === "dark";

  return (
    <div className="max-w-2xl">
      {eyebrow ? (
        <p className={cn("text-xs font-medium uppercase tracking-[0.16em]", onDark ? "text-on-ink" : "text-cta")}>
          {eyebrow}
        </p>
      ) : null}
      <h2
        id={titleId}
        className={cn(
          "text-[1.85rem] font-semibold leading-[1.15] tracking-tight sm:text-4xl",
          eyebrow ? "mt-3" : "",
          onDark ? "text-on-ink" : "text-foreground",
        )}
      >
        {title}
      </h2>
      {description ? (
        <p className={cn("mt-4 text-base leading-relaxed sm:text-lg", onDark ? "text-on-ink-muted" : "text-muted")}>
          {description}
        </p>
      ) : null}
    </div>
  );
}
