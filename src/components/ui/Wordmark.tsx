import { siteConfig } from "@/data/site-config";
import { cn } from "@/lib/cn";

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex min-w-0 items-center gap-2.5 font-semibold tracking-[-0.03em]", className)}>
      <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-cta" />
      <span className="truncate">{siteConfig.name}</span>
    </span>
  );
}
