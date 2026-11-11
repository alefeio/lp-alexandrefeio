"use client";

import { useRouter } from "next/navigation";
import { ManagedStudyDesk } from "@/components/learning/ManagedStudyDesk";
import type { StudyDesk as StudyDeskView, StudyDeskArea } from "@/lib/learning/study-desk";

export function StudyDeskPageClient({ desk, area }: { desk: StudyDeskView; area: StudyDeskArea }) {
  const router = useRouter();
  return (
    <ManagedStudyDesk
      desk={desk}
      area={area}
      composerDefaultLinkToLesson={false}
      onReload={() => router.refresh()}
    />
  );
}
