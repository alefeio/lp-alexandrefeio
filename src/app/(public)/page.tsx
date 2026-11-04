import type { Metadata } from "next";
import { CourseHome } from "@/components/home/CourseHome";
import { HomeContinuation } from "@/components/home/HomeContinuation";
import { listPublishedPostCards } from "@/lib/blog/service";
import { loadHomeContinuation } from "@/lib/home/load-home-continuation";
import { homeBelongsToViewer, publicHomeMetadata } from "@/lib/home/public-home";
import { getSession } from "@/lib/auth/session";
import { loadCourseCatalog } from "@/lib/learning/course-catalog";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: publicHomeMetadata.title,
  description: publicHomeMetadata.description,
  alternates: { canonical: publicHomeMetadata.canonical },
  openGraph: {
    title: publicHomeMetadata.title,
    description: publicHomeMetadata.description,
    url: publicHomeMetadata.canonical,
  },
};

export default async function Home() {
  const session = await getSession();
  const [courses, recentPosts] = await Promise.all([
    loadCourseCatalog(session?.user.id),
    listPublishedPostCards(3),
  ]);

  let continuation = null;
  if (session?.user.id) {
    const card = await loadHomeContinuation(session.user.id, session.user.name);
    if (homeBelongsToViewer(card.userId, session.user.id)) {
      continuation = <HomeContinuation card={card} />;
    }
  }

  return <CourseHome courses={courses} continuation={continuation} recentPosts={recentPosts} />;
}
