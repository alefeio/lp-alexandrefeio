import { cn } from "@/lib/cn";

export type ButtonVariant = "primary" | "secondary" | "inverted";

const variants: Record<ButtonVariant, string> = {
  primary: "bg-cta text-cta-foreground hover:bg-cta-hover",
  secondary: "border border-border bg-transparent text-foreground hover:bg-foreground/5",
  inverted: "bg-on-ink text-ink hover:bg-white",
};

export function buttonClass(variant: ButtonVariant = "primary", className?: string): string {
  return cn(
    "inline-flex min-h-12 items-center justify-center rounded-lg px-5 py-3 text-center text-sm font-medium leading-snug transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-60",
    variants[variant],
    className,
  );
}
