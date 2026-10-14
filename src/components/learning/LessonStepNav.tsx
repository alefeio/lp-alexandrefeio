import Link from "next/link";
import { buttonClass } from "@/lib/button-styles";
import { lessonStepNav, lessonStepNavClass, type LessonStepTarget } from "@/lib/learning/lesson-nav";

export function LessonStepNav({
  previous,
  next,
}: {
  previous: LessonStepTarget | null;
  next: LessonStepTarget | null;
}) {
  const steps = lessonStepNav({ previous, next });
  if (!steps.previous && !steps.next) return null;

  return (
    <div className={lessonStepNavClass.list}>
      {steps.previous ? (
        <Link href={steps.previous.href} className={`${buttonClass("secondary")} ${lessonStepNavClass.previous}`}>
          <span className="min-w-0">
            <span className="block text-xs font-medium uppercase tracking-[0.14em] text-muted">
              <span aria-hidden="true">← </span>
              {steps.previous.kicker}
            </span>
            <span className="mt-0.5 block font-normal break-words">{steps.previous.title}</span>
          </span>
        </Link>
      ) : (
        <span className="hidden sm:block" />
      )}
      {steps.next ? (
        <Link href={steps.next.href} className={`${buttonClass("primary")} ${lessonStepNavClass.next}`}>
          <span className="min-w-0">
            <span className="block text-xs font-medium uppercase tracking-[0.14em] text-cta-foreground/80">
              {steps.next.kicker}
              <span aria-hidden="true"> →</span>
            </span>
            <span className="mt-0.5 block break-words">{steps.next.title}</span>
          </span>
        </Link>
      ) : null}
    </div>
  );
}
