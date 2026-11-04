import { cn } from "@/lib/cn";

const COVER_WIDTH = 960;
const COVER_HEIGHT = 540;

export function BlogCoverImage({
  src,
  alt,
  priority = false,
  className,
}: {
  src: string | null | undefined;
  alt: string;
  priority?: boolean;
  className?: string;
}) {
  const url = src?.trim() || null;
  const label = alt.trim() || "Capa do artigo";

  return (
    <div
      className={cn(
        "relative aspect-[16/9] w-full overflow-hidden rounded-xl border border-border bg-[linear-gradient(145deg,rgba(30,94,255,0.12),rgba(15,23,42,0.06)_45%,rgba(15,23,42,0.02))]",
        className,
      )}
    >
      {url ? (
        // URLs editoriais vêm do APIMG; o artigo público já usa img nativo.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt={label}
          width={COVER_WIDTH}
          height={COVER_HEIGHT}
          loading={priority ? "eager" : "lazy"}
          decoding="async"
          className="h-full w-full object-cover"
        />
      ) : (
        <div className="absolute inset-0 flex items-end p-4" aria-hidden="true">
          <span className="text-xs font-medium uppercase tracking-[0.14em] text-cta/80">Alexandre Feio</span>
        </div>
      )}
    </div>
  );
}
