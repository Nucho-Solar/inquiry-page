export type Env = Record<string, string | undefined>;

function allSet(env: Env, keys: string[]): boolean {
  return keys.every((key) => (env[key] ?? "").trim() !== "");
}

export function hasTelegram(env: Env): boolean {
  return allSet(env, ["TELEGRAM_BOT_TOKEN", "TELEGRAM_CHAT_ID"]);
}

export function hasEmail(env: Env): boolean {
  return allSet(env, ["RESEND_API_KEY", "RESEND_FROM", "LEAD_EMAIL_TO"]);
}

export function hasForward(env: Env): boolean {
  return allSet(env, ["LEADS_WEBHOOK_URL", "LEADS_WEBHOOK_SECRET"]);
}
