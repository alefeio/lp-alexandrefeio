import Link from "next/link";
import { safeReturnPath } from "@/lib/auth/messages";
import { buttonClass, navigationLinkClass } from "@/lib/button-styles";

export function ReturnToLesson({
  returnTo,
  fallbackHref,
  fallbackLabel,
}: {
  returnTo?: string | null;
  fallbackHref: string;
  fallbackLabel: string;
}) {
  const back = safeReturnPath(returnTo);
  if (back) {
    return (
      <div className="mt-8 flex flex-col items-start gap-3">
        <Link className={buttonClass("secondary")} href={back}>
          Voltar à aula
        </Link>
        <Link className={navigationLinkClass()} href={fallbackHref}>
          {fallbackLabel}
        </Link>
        <Link className={navigationLinkClass()} href="/app">
          Ir para o início
        </Link>
      </div>
    );
  }
  return (
    <div className="mt-8 flex flex-col items-start gap-3">
      <Link className={buttonClass("secondary")} href={fallbackHref}>
        {fallbackLabel}
      </Link>
      <Link className={navigationLinkClass()} href="/app">
        Ir para o início
      </Link>
    </div>
  );
}
