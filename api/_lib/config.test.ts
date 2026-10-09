import { describe, expect, it } from "vitest";
import { emailRecipients, hasEmail, hasForward, hasTelegram, type Env } from "./config.js";

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

describe("emailRecipients", () => {
  it("splits on commas, trims and drops empty entries", () => {
    expect(emailRecipients({ LEAD_EMAIL_TO: " a@x.com ,, b@x.com , " })).toEqual(["a@x.com", "b@x.com"]);
  });

  it.each([undefined, "", " ", ",", " , ,"])("returns no recipients for %j", (value) => {
    expect(emailRecipients({ LEAD_EMAIL_TO: value })).toEqual([]);
  });
});

describe("hasEmail with only separators in LEAD_EMAIL_TO", () => {
  const ok: Env = { RESEND_API_KEY: "k", RESEND_FROM: "f@x.com" };

  it.each([",", " , ", ",,,"])("is false for %j", (value) => {
    expect(hasEmail({ ...ok, LEAD_EMAIL_TO: value })).toBe(false);
  });

  it("is true with one real recipient among separators", () => {
    expect(hasEmail({ ...ok, LEAD_EMAIL_TO: ", a@x.com," })).toBe(true);
  });
});
