import { StudyDeskPanel } from "@/components/learning/StudyDeskPanel";
import type { StudyDesk as StudyDeskView, StudyDeskArea } from "@/lib/learning/study-desk";

export function StudyDesk({
  desk,
  area,
  composer,
}: {
  desk: StudyDeskView;
  area: StudyDeskArea;
  composer?: React.ReactNode;
}) {
  return <StudyDeskPanel desk={desk} area={area} composer={composer} />;
}
