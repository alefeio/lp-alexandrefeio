"use server";

import { Resend } from "resend";
import { buildLeadEmail, deliverLeadEmail, prepareLead, type LeadErrors, type LeadInput } from "@/lib/lead";

export type SubmitLeadResult =
  | { ok: true }
  | { ok: false; reason: "invalid"; errors: LeadErrors }
  | { ok: false; reason: "rejected" };

export async function submitLead(input: LeadInput): Promise<SubmitLeadResult> {
  const prepared = prepareLead(input);
  if (!prepared.ok) return prepared;

  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.CONTACT_TO_EMAIL;
  const from = process.env.CONTACT_FROM_EMAIL;

  if (!apiKey || !to || !from) {
    console.error("contact form: missing email configuration");
    return { ok: false, reason: "rejected" };
  }

  const email = buildLeadEmail(prepared.lead);
  const outcome = await deliverLeadEmail(email, async (message) => {
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from,
      to: [to],
      subject: message.subject,
      html: message.html,
      text: message.text,
    });

    if (!error) return null;
    console.error("contact form send failed", { name: error.name, statusCode: error.statusCode });
    return { name: error.name, statusCode: error.statusCode };
  });

  if (outcome === "failed") return { ok: false, reason: "rejected" };

  return { ok: true };
}
