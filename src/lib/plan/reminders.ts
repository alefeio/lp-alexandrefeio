import { getPrisma } from "@/lib/db/prisma";
import { sendReminderEmail } from "@/lib/email/reminder-mail";

export type ReminderSender = (input: { to: string; projectName: string; title: string; planUrl: string }) => Promise<void>;

function origin() {
  return (process.env.BETTER_AUTH_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

export async function processDueReminders(send: ReminderSender = sendReminderEmail, now = new Date(), projectId?: string) {
  const due = await getPrisma().reminder.findMany({
    where: {
      ...(projectId ? { projectId } : {}),
      emailEnabled: true,
      emailSentAt: null,
      dismissedAt: null,
      remindAt: { lte: now },
      project: { status: "ACTIVE" },
    },
    include: { project: { select: { id: true, name: true, user: { select: { email: true } } } } },
    take: 50,
  });

  let sent = 0;
  let skipped = 0;
  for (const reminder of due) {
    const stillOpen = await getPrisma().reminder.findFirst({
      where: { id: reminder.id, emailSentAt: null, dismissedAt: null },
    });
    if (!stillOpen) {
      skipped += 1;
      continue;
    }
    try {
      await send({
        to: reminder.project.user.email,
        projectName: reminder.project.name,
        title: reminder.title,
        planUrl: `${origin()}/app/projetos/${reminder.project.id}/plano`,
      });
      const updated = await getPrisma().reminder.updateMany({
        where: { id: reminder.id, emailSentAt: null },
        data: { emailSentAt: new Date() },
      });
      if (updated.count === 1) sent += 1;
      else skipped += 1;
    } catch (error) {
      skipped += 1;
      console.error("reminder email failed", { name: error instanceof Error ? error.name : "Error" });
    }
  }
  return { sent, skipped };
}
