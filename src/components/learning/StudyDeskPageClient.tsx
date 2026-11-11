"use client";

import { useRouter } from "next/navigation";
import { PersonalNoteComposer } from "@/components/learning/PersonalNoteComposer";
import { StudyDesk } from "@/components/learning/StudyDesk";
import type { StudyDesk as StudyDeskView, StudyDeskArea } from "@/lib/learning/study-desk";

export function StudyDeskPageClient({ desk, area }: { desk: StudyDeskView; area: StudyDeskArea }) {
  const router = useRouter();
  return (
    <StudyDesk
      desk={desk}
      area={area}
      composer={<PersonalNoteComposer defaultLinkToLesson={false} onSaved={() => router.refresh()} />}
    />
  );
}
