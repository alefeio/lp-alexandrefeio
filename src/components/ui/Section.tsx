import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function Section({
  id,
  titleId,
  children,
  className,
}: {
  id: string;
  titleId?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      id={id}
      aria-labelledby={titleId ?? `${id}-titulo`}
      className={cn("scroll-mt-36 border-t border-border py-20 sm:py-28", className)}
    >
      {children}
    </section>
  );
}
