export type LessonStepTarget = {
  slug: string;
  title: string;
};

export type LessonStepLink = {
  href: string;
  title: string;
  kicker: "Aula anterior" | "Próxima aula";
  direction: "previous" | "next";
  variant: "secondary" | "primary";
};

/** Avançar é a ação principal. Voltar fica outline e, no mobile, abaixo. */
export const lessonStepNavClass = {
  list: "mt-6 flex w-full min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between",
  previous: "order-2 w-full min-w-0 max-w-full sm:order-1 sm:w-auto sm:max-w-xs",
  next: "order-1 w-full min-w-0 max-w-full sm:order-2 sm:ml-auto sm:w-auto sm:max-w-md",
} as const;

export function lessonStepNav(input: {
  previous: LessonStepTarget | null;
  next: LessonStepTarget | null;
}): {
  previous: LessonStepLink | null;
  next: LessonStepLink | null;
  desktopOrder: readonly ["previous", "next"];
  mobileOrder: readonly ["next", "previous"];
} {
  return {
    previous: input.previous ? stepLink(input.previous, "previous") : null,
    next: input.next ? stepLink(input.next, "next") : null,
    desktopOrder: ["previous", "next"],
    mobileOrder: ["next", "previous"],
  };
}

function stepLink(target: LessonStepTarget, direction: "previous" | "next"): LessonStepLink {
  if (direction === "previous") {
    return {
      href: `/aulas/${target.slug}`,
      title: target.title,
      kicker: "Aula anterior",
      direction,
      variant: "secondary",
    };
  }
  return {
    href: `/aulas/${target.slug}`,
    title: target.title,
    kicker: "Próxima aula",
    direction,
    variant: "primary",
  };
}
