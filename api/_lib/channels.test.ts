import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { InquiryPayload } from "../../src/lib/inquirySchema.js";
import {
  CHANNEL_TIMEOUT_MS,
  forwardLead,
  sendEmail,
  sendTelegram,
  type Env,
} from "./channels.js";
import { formatEmail, formatTelegram } from "./format.js";
import { toLead } from "./lead.js";
import { hmacSha256Hex, signPayload } from "./sign.js";

const NOW = new Date("2026-10-08T19:44:00.000Z");

const lead = toLead(
  {
    useCase: "home",
    services: ["Solar panels"],
    name: "Jane Wanjiru",
    phone: "+254712345678",
    location: "Karen",
    budget: "KSh 100,000 - 250,000",
    explanation: "Need backup",
    submissionId: "11111111-1111-4111-8111-111111111111",
    website: "",
    formStartedAt: 1,
    attribution: { gclid: "abc" },
  } satisfies InquiryPayload,
  NOW,
);

const TG_ENV: Env = { TELEGRAM_BOT_TOKEN: "123:SECRET-TOKEN", TELEGRAM_CHAT_ID: "-100555" };
const EMAIL_ENV: Env = {
  RESEND_API_KEY: "re_secret_key",
  RESEND_FROM: "Leads <leads@example.com>",
  LEAD_EMAIL_TO: "a@x.com, b@x.com",
};
const FWD_ENV: Env = {
  LEADS_WEBHOOK_URL: "https://hooks.example.com/leads",
  LEADS_WEBHOOK_SECRET: "whsec_test",
};

let fetchMock: ReturnType<typeof vi.fn>;
let errorSpy: ReturnType<typeof vi.spyOn>;

function respond(status: number) {
  fetchMock.mockResolvedValue(new Response("upstream body mentions Jane Wanjiru", { status }));
}

function call(index = 0): { url: string; init: RequestInit; headers: Headers; body: string } {
  const [url, init] = fetchMock.mock.calls[index] as [string, RequestInit];
  return { url, init, headers: new Headers(init.headers), body: String(init.body) };
}

function loggedText(): string {
  return errorSpy.mock.calls.map((args) => args.map(String).join(" ")).join("\n");
}

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("hmacSha256Hex", () => {
  it("matches RFC 4231 test case 2", () => {
    expect(hmacSha256Hex("Jefe", "what do ya want for nothing?")).toBe(
      "5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843",
    );
  });
});

describe("signPayload", () => {
  it("signs `${timestamp}.${body}`", () => {
    expect(signPayload("s", "1700000000", "{}")).toBe(hmacSha256Hex("s", "1700000000.{}"));
  });
});

describe("sendTelegram", () => {
  it("skips without calling fetch when the token or chat id is missing", async () => {
    expect(await sendTelegram(lead, { TELEGRAM_CHAT_ID: "1" })).toEqual({
      channel: "telegram",
      status: "skipped",
    });
    expect(await sendTelegram(lead, { TELEGRAM_BOT_TOKEN: "t" })).toEqual({
      channel: "telegram",
      status: "skipped",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("posts the formatted message and returns ok on 200", async () => {
    respond(200);
    expect(await sendTelegram(lead, TG_ENV)).toEqual({ channel: "telegram", status: "ok" });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const { url, init, headers, body } = call();
    expect(url).toBe("https://api.telegram.org/bot123:SECRET-TOKEN/sendMessage");
    expect(init.method).toBe("POST");
    expect(headers.get("content-type")).toBe("application/json");
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(init.redirect).toBe("error");
    const { text, replyMarkup } = formatTelegram(lead);
    expect(JSON.parse(body)).toEqual({
      chat_id: "-100555",
      text,
      parse_mode: "HTML",
      reply_markup: replyMarkup,
      disable_web_page_preview: true,
    });
    expect(body).not.toContain("SECRET-TOKEN");
  });

  it("returns failed on 429 and logs only ids", async () => {
    respond(429);
    expect(await sendTelegram(lead, TG_ENV)).toEqual({ channel: "telegram", status: "failed" });
    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(JSON.parse(String(errorSpy.mock.calls[0][0]))).toEqual({
      leadId: lead.id,
      channel: "telegram",
      status: "failed",
    });
  });

  it("returns failed when fetch throws a TypeError", async () => {
    fetchMock.mockRejectedValue(new TypeError("fetch failed for Jane Wanjiru +254712345678"));
    expect(await sendTelegram(lead, TG_ENV)).toEqual({ channel: "telegram", status: "failed" });
    expect(loggedText()).not.toContain("fetch failed");
  });

  it("returns failed on an AbortError", async () => {
    fetchMock.mockRejectedValue(new DOMException("The operation was aborted", "AbortError"));
    expect(await sendTelegram(lead, TG_ENV)).toEqual({ channel: "telegram", status: "failed" });
  });

  it("returns failed on a TimeoutError", async () => {
    fetchMock.mockRejectedValue(new DOMException("timed out", "TimeoutError"));
    expect(await sendTelegram(lead, TG_ENV)).toEqual({ channel: "telegram", status: "failed" });
  });
});

describe("sendEmail", () => {
  it("skips without calling fetch when RESEND_API_KEY is missing", async () => {
    const { RESEND_API_KEY: _omit, ...env } = EMAIL_ENV;
    expect(await sendEmail(lead, env)).toEqual({ channel: "email", status: "skipped" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("posts to Resend with idempotency key and split recipients", async () => {
    respond(200);
    expect(await sendEmail(lead, EMAIL_ENV)).toEqual({ channel: "email", status: "ok" });

    const { url, init, headers, body } = call();
    expect(url).toBe("https://api.resend.com/emails");
    expect(init.method).toBe("POST");
    expect(headers.get("authorization")).toBe("Bearer re_secret_key");
    expect(headers.get("content-type")).toBe("application/json");
    expect(headers.get("idempotency-key")).toBe(lead.id);
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(init.redirect).toBe("error");
    expect(JSON.parse(body)).toEqual({
      from: "Leads <leads@example.com>",
      to: ["a@x.com", "b@x.com"],
      ...formatEmail(lead),
    });
  });

  it("drops empty recipients", async () => {
    respond(200);
    await sendEmail(lead, { ...EMAIL_ENV, LEAD_EMAIL_TO: " a@x.com ,, b@x.com , " });
    expect(JSON.parse(call().body).to).toEqual(["a@x.com", "b@x.com"]);
  });

  it("returns failed on 422", async () => {
    respond(422);
    expect(await sendEmail(lead, EMAIL_ENV)).toEqual({ channel: "email", status: "failed" });
    expect(JSON.parse(String(errorSpy.mock.calls[0][0]))).toEqual({
      leadId: lead.id,
      channel: "email",
      status: "failed",
    });
  });

  it("returns failed when fetch throws", async () => {
    fetchMock.mockRejectedValue(new TypeError("boom"));
    expect(await sendEmail(lead, EMAIL_ENV)).toEqual({ channel: "email", status: "failed" });
  });
});

describe("forwardLead", () => {
  it("skips without calling fetch when LEADS_WEBHOOK_URL is missing", async () => {
    const { LEADS_WEBHOOK_URL: _omit, ...env } = FWD_ENV;
    expect(await forwardLead(lead, env)).toEqual({ channel: "forward", status: "skipped" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends the lead with a timestamp and a verifiable signature", async () => {
    respond(200);
    expect(await forwardLead(lead, FWD_ENV, NOW)).toEqual({ channel: "forward", status: "ok" });

    const { url, init, headers, body } = call();
    expect(url).toBe("https://hooks.example.com/leads");
    expect(init.method).toBe("POST");
    expect(headers.get("content-type")).toBe("application/json");
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(init.redirect).toBe("error");
    expect(body).toBe(JSON.stringify(lead));

    const timestamp = headers.get("x-timestamp");
    expect(timestamp).toBe(String(Math.floor(NOW.getTime() / 1000)));
    expect(headers.get("x-signature")).toBe(
      `sha256=${signPayload("whsec_test", timestamp as string, body)}`,
    );
  });

  it("defaults the timestamp to the current time", async () => {
    respond(200);
    const before = Math.floor(Date.now() / 1000);
    await forwardLead(lead, FWD_ENV);
    const ts = Number(call().headers.get("x-timestamp"));
    expect(ts).toBeGreaterThanOrEqual(before);
    expect(ts).toBeLessThanOrEqual(Math.floor(Date.now() / 1000));
  });

  it("returns failed on 500", async () => {
    respond(500);
    expect(await forwardLead(lead, FWD_ENV, NOW)).toEqual({ channel: "forward", status: "failed" });
    expect(JSON.parse(String(errorSpy.mock.calls[0][0]))).toEqual({
      leadId: lead.id,
      channel: "forward",
      status: "failed",
    });
  });

  it("returns failed when a redirect makes fetch throw, leaking nothing", async () => {
    fetchMock.mockRejectedValue(
      new TypeError("fetch failed: redirect mode is set to error: https://evil.example.net/x"),
    );
    expect(await forwardLead(lead, FWD_ENV, NOW)).toEqual({ channel: "forward", status: "failed" });
    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(JSON.parse(String(errorSpy.mock.calls[0][0]))).toEqual({
      leadId: lead.id,
      channel: "forward",
      status: "failed",
    });
    const logged = loggedText();
    for (const leaked of ["Jane", "254712345678", "whsec_test", "hooks.example.com", "evil.example.net"]) {
      expect(logged).not.toContain(leaked);
    }
  });

  it("returns failed when fetch throws", async () => {
    fetchMock.mockRejectedValue(new Error("connect ECONNREFUSED https://hooks.example.com/leads"));
    expect(await forwardLead(lead, FWD_ENV, NOW)).toEqual({ channel: "forward", status: "failed" });
    expect(loggedText()).not.toContain("hooks.example.com");
  });
});

describe("privacy", () => {
  it("never exposes name, phone, tokens or URLs in results or logs", async () => {
    const results = [];
    for (const status of [500, 429, 422]) {
      respond(status);
      results.push(await sendTelegram(lead, TG_ENV));
      results.push(await sendEmail(lead, EMAIL_ENV));
      results.push(await forwardLead(lead, FWD_ENV, NOW));
    }
    fetchMock.mockRejectedValue(new TypeError("Jane Wanjiru +254712345678"));
    results.push(await sendTelegram(lead, TG_ENV));
    results.push(await sendEmail(lead, EMAIL_ENV));
    results.push(await forwardLead(lead, FWD_ENV, NOW));

    const everything = JSON.stringify(results) + "\n" + loggedText();
    expect(errorSpy).toHaveBeenCalledTimes(12);
    for (const secret of [
      "Jane",
      "Wanjiru",
      "254712345678",
      "SECRET-TOKEN",
      "re_secret_key",
      "whsec_test",
      "hooks.example.com",
    ]) {
      expect(everything).not.toContain(secret);
    }
  });

  it("uses a 5 second channel timeout", () => {
    expect(CHANNEL_TIMEOUT_MS).toBe(5000);
  });
});
