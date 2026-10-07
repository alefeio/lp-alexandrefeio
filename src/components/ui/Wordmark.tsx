import Image from "next/image";
import { siteConfig } from "@/data/site-config";
import { cn } from "@/lib/cn";

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex min-w-0 items-center", className)}>
      <Image
        src="/logoAF_vert.png"
        alt={siteConfig.name}
        width={600}
        height={96}
        className="h-7 w-auto max-w-[min(100%,11.5rem)] object-contain object-left sm:h-8 sm:max-w-[13.5rem]"
        priority
      />
    </span>
  );
}
