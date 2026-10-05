"use server";

import { Resend } from "resend";
import { dispatchLeadEmails, prepareLead, type LeadErrors, type LeadInput } from "@/lib/lead";

export type SubmitLeadResult =
  | { ok: true; confirmation: "sent" | "failed" }
  | { ok: false; reason: "invalid"; errors: LeadErrors }
  | { ok: false; reason: "rejected" };

export async function submitLead(input: LeadInput): Promise<SubmitLeadResult> {
  const prepared = prepareLead(input);
  if (!prepared.ok) return prepared;

  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.CONTACT_TO_EMAIL;
  const from = process.env.CONTACT_FROM_EMAIL;
  const replyTo = process.env.CONTACT_REPLY_TO_EMAIL;

  if (!apiKey || !to || !from || !replyTo) {
    console.error("contact form: missing email configuration");
    return { ok: false, reason: "rejected" };
  }

  const resend = new Resend(apiKey);
  const outcome = await dispatchLeadEmails(prepared.lead, { adminTo: to, replyTo }, async (message) => {
    const { error } = await resend.emails.send({
      from,
      to: [message.to],
      replyTo: message.replyTo,
      subject: message.subject,
      html: message.html,
      text: message.text,
    });

    if (!error) return null;
    return { name: error.name, statusCode: error.statusCode };
  });

  if (!outcome.ok) return { ok: false, reason: "rejected" };
  return { ok: true, confirmation: outcome.confirmation };
}
