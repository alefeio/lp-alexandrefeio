import Link from "next/link";
import { buttonClass } from "@/lib/button-styles";
import type { StudentCourseHub as StudentCourseHubView } from "@/lib/learning/student-course-hub";

export function StudentCourseHub({ hub }: { hub: StudentCourseHubView }) {
  return (
    <div>
      <h1 className="text-3xl font-semibold tracking-tight">{hub.title}</h1>
      <p className="mt-3 max-w-2xl text-base leading-relaxed text-muted">{hub.subtitle}</p>
      <ul className="mt-8 grid gap-4 sm:grid-cols-2">
        {hub.courses.map((course) => (
          <li key={course.slug} className="flex flex-col rounded-xl border border-border bg-surface p-5">
            <h2 className="text-xl font-semibold tracking-tight">{course.title}</h2>
            <p className="mt-2 text-sm font-medium">{course.statusLabel}</p>
            <p className="mt-3 text-sm leading-relaxed text-muted">{course.promise}</p>
            <p className="mt-3 text-sm">{course.progressLabel}</p>
            {course.positionLabel ? <p className="mt-2 text-sm">{course.positionLabel}</p> : null}
            {course.accessNote ? <p className="mt-2 text-sm text-muted">{course.accessNote}</p> : null}
            <p className="mt-5">
              <Link className={buttonClass("primary")} href={course.href}>
                {course.ctaLabel}
              </Link>
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
