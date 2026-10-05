import { cn } from "@/lib/cn";

export type ButtonVariant = "primary" | "secondary" | "inverted";

const variants: Record<ButtonVariant, string> = {
  primary:
    "bg-cta text-cta-foreground shadow-[0_10px_22px_-14px_rgba(30,94,255,0.9)] hover:bg-cta-hover active:bg-cta-hover",
  secondary: "border border-border bg-surface text-foreground hover:border-cta/40 hover:bg-white",
  inverted: "bg-white text-ink hover:text-cta",
};

export function buttonClass(variant: ButtonVariant = "primary", className?: string): string {
  return cn(
    "inline-flex min-h-12 cursor-pointer items-center justify-center rounded-lg px-5 py-3 text-center text-sm font-medium leading-snug transition-[background-color,border-color,color,transform,box-shadow] duration-200 motion-safe:active:translate-y-px disabled:cursor-not-allowed disabled:opacity-60 disabled:shadow-none disabled:active:translate-y-0",
    variants[variant],
    className,
  );
}
