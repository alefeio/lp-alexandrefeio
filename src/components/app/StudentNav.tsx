"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SignOutButton } from "@/components/auth/AuthForms";
import { STUDENT_NAV, activeStudentItem } from "@/lib/home/student-nav";

export function StudentNav() {
  const pathname = usePathname() ?? "";
  const active = activeStudentItem(pathname);

  return (
    <nav aria-label="Área do aluno" className="flex w-full min-w-0 items-center gap-1 overflow-x-auto sm:w-auto sm:max-w-full">
      <ul className="flex items-center gap-0.5">
        {STUDENT_NAV.map((item) => {
          const current = active === item.id;
          return (
            <li key={item.id} className="shrink-0">
              <Link
                href={item.href}
                aria-current={current ? "page" : undefined}
                className={`inline-flex min-h-12 items-center whitespace-nowrap rounded-md px-3 text-sm underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cta ${
                  current ? "font-semibold text-foreground underline" : "text-muted hover:text-foreground hover:underline"
                }`}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
      <span className="inline-flex min-h-12 shrink-0 items-center px-3">
        <SignOutButton />
      </span>
    </nav>
  );
}
