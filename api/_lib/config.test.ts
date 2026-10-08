import { describe, expect, it } from "vitest";
import { hasEmail, hasForward, hasTelegram, type Env } from "./config.js";

const cases: [string, (env: Env) => boolean, string[]][] = [
  ["hasTelegram", hasTelegram, ["TELEGRAM_BOT_TOKEN", "TELEGRAM_CHAT_ID"]],
  ["hasEmail", hasEmail, ["RESEND_API_KEY", "RESEND_FROM", "LEAD_EMAIL_TO"]],
  ["hasForward", hasForward, ["LEADS_WEBHOOK_URL", "LEADS_WEBHOOK_SECRET"]],
];

describe.each(cases)("%s", (_name, fn, keys) => {
  const full: Env = Object.fromEntries(keys.map((k) => [k, `value-${k}`]));

  it("is true when all vars are present", () => {
    expect(fn(full)).toBe(true);
  });

  it("is false for an empty env", () => {
    expect(fn({})).toBe(false);
  });

  it.each(keys)("is false when %s is missing", (key) => {
    const env = { ...full };
    delete env[key];
    expect(fn(env)).toBe(false);
  });

  it.each(keys)("is false when %s is undefined, empty or whitespace-only", (key) => {
    expect(fn({ ...full, [key]: undefined })).toBe(false);
    expect(fn({ ...full, [key]: "" })).toBe(false);
    expect(fn({ ...full, [key]: " \t\n " })).toBe(false);
  });
});
