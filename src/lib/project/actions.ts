"use server";

import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { archiveProjectForUser, createProjectForUser, updateProjectForUser } from "@/lib/project/service";
import { readProjectForm } from "@/lib/project/schema";

export async function createProjectAction(formData: FormData) {
  const session = await requireSession();
  const result = await createProjectForUser(session.user.id, readProjectForm(formData));
  if (!result.ok) return result;
  redirect(`/app/projetos/${result.project.id}`);
}

export async function updateProjectAction(projectId: string, formData: FormData) {
  const session = await requireSession();
  const result = await updateProjectForUser(session.user.id, projectId, readProjectForm(formData));
  if (!result.ok) return result;
  redirect(`/app/projetos/${result.project.id}`);
}

export async function archiveProjectAction(projectId: string) {
  const session = await requireSession();
  await archiveProjectForUser(session.user.id, projectId);
  redirect("/app/projetos");
}
