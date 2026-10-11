import { processDueReminders } from "@/lib/plan/reminders";

export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return new Response("Cron não configurado.", { status: 503 });
  if (request.headers.get("authorization") !== `Bearer ${secret}`) return new Response("Não autorizado.", { status: 401 });
  const result = await processDueReminders();
  return Response.json({ sent: result.sent, skipped: result.skipped });
}
