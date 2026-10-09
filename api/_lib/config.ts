export type Env = Record<string, string | undefined>;

function allSet(env: Env, keys: string[]): boolean {
  return keys.every((key) => (env[key] ?? "").trim() !== "");
}

export function hasTelegram(env: Env): boolean {
  return allSet(env, ["TELEGRAM_BOT_TOKEN", "TELEGRAM_CHAT_ID"]);
}

export function emailRecipients(env: Env): string[] {
  return (env.LEAD_EMAIL_TO ?? "")
    .split(",")
    .map((address) => address.trim())
    .filter((address) => address !== "");
}

// A LEAD_EMAIL_TO of only commas counts as unset, so a bad value fails loudly instead of per lead.
export function hasEmail(env: Env): boolean {
  return allSet(env, ["RESEND_API_KEY", "RESEND_FROM"]) && emailRecipients(env).length > 0;
}

export function hasForward(env: Env): boolean {
  return allSet(env, ["LEADS_WEBHOOK_URL", "LEADS_WEBHOOK_SECRET"]);
}
