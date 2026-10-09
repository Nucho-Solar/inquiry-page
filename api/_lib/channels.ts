import { createHash } from "node:crypto";
import { emailRecipients, hasEmail, hasForward, hasTelegram, type Env } from "./config.js";
import { formatEmail, formatTelegram } from "./format.js";
import type { Lead } from "./lead.js";
import { signPayload } from "./sign.js";

export type { Env };

export type ChannelResult = {
  channel: "telegram" | "email" | "forward";
  status: "ok" | "failed" | "skipped";
};

export const CHANNEL_TIMEOUT_MS = 5000;

type Channel = ChannelResult["channel"];

// Never rejects. Logs only the lead id, channel and status: no PII, URLs, tokens or error text.
async function post(
  lead: Lead,
  channel: Channel,
  url: string,
  headers: Record<string, string>,
  body: string,
): Promise<ChannelResult> {
  let ok = false;
  try {
    const res = await fetch(url, {
      method: "POST",
      redirect: "error",
      headers,
      body,
      signal: AbortSignal.timeout(CHANNEL_TIMEOUT_MS),
    });
    ok = res.ok;
    // The reply is never read, so release the connection instead of waiting for garbage collection.
    void res.body?.cancel().catch(() => undefined);
  } catch {
    ok = false;
  }
  if (ok) return { channel, status: "ok" };
  console.error(JSON.stringify({ leadId: lead.id, channel, status: "failed" }));
  return { channel, status: "failed" };
}

// An unconfigured alert channel is logged (lead id and channel only: no variable names or values).
function skipped(lead: Lead, channel: Channel): ChannelResult {
  console.error(JSON.stringify({ leadId: lead.id, channel, status: "skipped" }));
  return { channel, status: "skipped" };
}

export async function sendTelegram(lead: Lead, env: Env): Promise<ChannelResult> {
  if (!hasTelegram(env)) return skipped(lead, "telegram");
  const { text, replyMarkup } = formatTelegram(lead);
  return post(
    lead,
    "telegram",
    `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`,
    { "Content-Type": "application/json" },
    JSON.stringify({
      chat_id: env.TELEGRAM_CHAT_ID,
      text,
      parse_mode: "HTML",
      reply_markup: replyMarkup,
      disable_web_page_preview: true,
    }),
  );
}

export async function sendEmail(lead: Lead, env: Env): Promise<ChannelResult> {
  if (!hasEmail(env)) return skipped(lead, "email");
  const message = formatEmail(lead);
  // The visitor can fix a typo and resubmit with the same lead id. A key from the id alone would
  // make Resend answer 409 for the corrected email, so the key also covers the email content.
  const contentHash = createHash("sha256")
    .update(message.subject)
    .update("\0")
    .update(message.text)
    .digest("hex")
    .slice(0, 16);
  return post(
    lead,
    "email",
    "https://api.resend.com/emails",
    {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
      "Idempotency-Key": `${lead.id}-${contentHash}`,
    },
    JSON.stringify({ from: env.RESEND_FROM, to: emailRecipients(env), ...message }),
  );
}

export async function forwardLead(
  lead: Lead,
  env: Env,
  now: Date = new Date(),
): Promise<ChannelResult> {
  if (!hasForward(env)) return { channel: "forward", status: "skipped" };
  const body = JSON.stringify(lead);
  const timestamp = String(Math.floor(now.getTime() / 1000));
  const signature = signPayload(env.LEADS_WEBHOOK_SECRET as string, timestamp, body);
  return post(
    lead,
    "forward",
    env.LEADS_WEBHOOK_URL as string,
    {
      "Content-Type": "application/json",
      "X-Timestamp": timestamp,
      "X-Signature": `sha256=${signature}`,
    },
    body,
  );
}
