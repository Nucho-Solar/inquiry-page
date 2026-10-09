import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { budgetOptions } from "../../src/lib/inquirySchema.js";
import { forwardLead, sendEmail, sendTelegram, type ChannelResult } from "./channels.js";
import type { Env } from "./config.js";
import { handleInquiry } from "../inquiry.js";

vi.mock("./channels.js", () => ({
  sendTelegram: vi.fn(),
  sendEmail: vi.fn(),
  forwardLead: vi.fn(),
}));

const NOW = new Date("2026-10-08T19:44:00.000Z");
const NAME = "Jane Wanjiru";
const PHONE = "0712345678";
const ID = "11111111-1111-4111-8111-111111111111";

const FULL_ENV: Env = {
  TELEGRAM_BOT_TOKEN: "t",
  TELEGRAM_CHAT_ID: "c",
  RESEND_API_KEY: "r",
  RESEND_FROM: "from@example.com",
  LEAD_EMAIL_TO: "to@example.com",
};

function payload(overrides: Record<string, unknown> = {}) {
  return {
    useCase: "home",
    services: ["Backup Inverter"],
    name: NAME,
    phone: PHONE,
    location: "Karen",
    budget: budgetOptions[2],
    explanation: "",
    submissionId: ID,
    website: "",
    fillMs: 60000,
    attribution: {},
    ...overrides,
  };
}

function post(body: unknown, headers: Record<string, string> = {}) {
  return new Request("https://example.com/api/inquiry", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

function result(
  channel: ChannelResult["channel"],
  status: ChannelResult["status"],
): ChannelResult {
  return { channel, status };
}

function setResults(
  telegram: ChannelResult["status"],
  email: ChannelResult["status"],
  forward: ChannelResult["status"] = "skipped",
) {
  vi.mocked(sendTelegram).mockResolvedValue(result("telegram", telegram));
  vi.mocked(sendEmail).mockResolvedValue(result("email", email));
  vi.mocked(forwardLead).mockResolvedValue(result("forward", forward));
}

function expectNoSenderCalled() {
  expect(sendTelegram).not.toHaveBeenCalled();
  expect(sendEmail).not.toHaveBeenCalled();
  expect(forwardLead).not.toHaveBeenCalled();
}

beforeEach(() => {
  vi.resetAllMocks();
  setResults("ok", "ok");
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("handleInquiry response rule", () => {
  it("returns 200 when telegram ok and email failed", async () => {
    setResults("ok", "failed");
    const res = await handleInquiry(post(payload()), FULL_ENV, NOW);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(res.headers.get("Content-Type")).toBe("application/json");
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });

  it("returns 502 when both channels failed", async () => {
    setResults("failed", "failed");
    const res = await handleInquiry(post(payload()), FULL_ENV, NOW);
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ ok: false, error: "delivery_failed" });
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });

  it("returns 200 when telegram skipped and email ok", async () => {
    setResults("skipped", "ok");
    const res = await handleInquiry(post(payload()), FULL_ENV, NOW);
    expect(res.status).toBe(200);
  });

  it("returns 502 when telegram skipped and email failed", async () => {
    setResults("skipped", "failed");
    const res = await handleInquiry(post(payload()), FULL_ENV, NOW);
    expect(res.status).toBe(502);
  });

  it("ignores a failed forward when telegram ok", async () => {
    setResults("ok", "skipped", "failed");
    const res = await handleInquiry(post(payload()), FULL_ENV, NOW);
    expect(res.status).toBe(200);
    expect(forwardLead).toHaveBeenCalledTimes(1);
  });

  it("ignores an ok forward when both channels failed", async () => {
    setResults("failed", "failed", "ok");
    const res = await handleInquiry(post(payload()), FULL_ENV, NOW);
    expect(res.status).toBe(502);
  });

  it("passes a lead whose id is the submissionId to every sender", async () => {
    await handleInquiry(post(payload()), FULL_ENV, NOW);
    for (const sender of [sendTelegram, sendEmail, forwardLead]) {
      expect(sender).toHaveBeenCalledTimes(1);
      const lead = vi.mocked(sender).mock.calls[0][0];
      expect(lead.id).toBe(ID);
      expect(lead.receivedAt).toBe(NOW.toISOString());
      expect(lead.phone).toBe("+254712345678");
      expect(lead).not.toHaveProperty("website");
      expect(lead).not.toHaveProperty("fillMs");
    }
  });
});

describe("handleInquiry forward", () => {
  it("responds without waiting for a forward that never settles", async () => {
    setResults("ok", "ok");
    vi.mocked(forwardLead).mockReturnValue(new Promise(() => {}));
    const defer = vi.fn();
    const res = await handleInquiry(post(payload()), FULL_ENV, NOW, defer);
    expect(res.status).toBe(200);
    expect(defer).toHaveBeenCalledTimes(1);
    expect(defer.mock.calls[0][0]).toBeInstanceOf(Promise);
  }, 1000);

  it("hands the forward to the runtime so it can finish after the response", async () => {
    let settle!: (value: ChannelResult) => void;
    vi.mocked(forwardLead).mockReturnValue(new Promise((resolve) => (settle = resolve)));
    const deferred: Promise<unknown>[] = [];
    const res = await handleInquiry(post(payload()), FULL_ENV, NOW, (p) => deferred.push(p));
    expect(res.status).toBe(200);
    expect(deferred).toHaveLength(1);
    settle(result("forward", "ok"));
    await expect(deferred[0]).resolves.toBeUndefined();
  });

  it("does not let a rejecting forward change the response or surface as an unhandled rejection", async () => {
    vi.mocked(forwardLead).mockRejectedValue(new Error("boom"));
    const deferred: Promise<unknown>[] = [];
    const res = await handleInquiry(post(payload()), FULL_ENV, NOW, (p) => deferred.push(p));
    expect(res.status).toBe(200);
    await expect(deferred[0]).resolves.toBeUndefined();
  });

  it("starts the forward even when both alert channels fail", async () => {
    setResults("failed", "failed");
    const defer = vi.fn();
    const res = await handleInquiry(post(payload()), FULL_ENV, NOW, defer);
    expect(res.status).toBe(502);
    expect(forwardLead).toHaveBeenCalledTimes(1);
    expect(defer).toHaveBeenCalledTimes(1);
  });
});

describe("handleInquiry request validation", () => {
  it("returns 405 with Allow header for GET", async () => {
    const res = await handleInquiry(
      new Request("https://example.com/api/inquiry", { method: "GET" }),
      FULL_ENV,
      NOW,
    );
    expect(res.status).toBe(405);
    expect(res.headers.get("Allow")).toBe("POST");
    expectNoSenderCalled();
  });

  it("returns 415 for text/plain", async () => {
    const res = await handleInquiry(
      post(JSON.stringify(payload()), { "Content-Type": "text/plain" }),
      FULL_ENV,
      NOW,
    );
    expect(res.status).toBe(415);
    expectNoSenderCalled();
  });

  it("accepts application/json with a charset parameter", async () => {
    const res = await handleInquiry(
      post(payload(), { "Content-Type": "application/json; charset=utf-8" }),
      FULL_ENV,
      NOW,
    );
    expect(res.status).toBe(200);
  });

  it("returns 413 for a 10241-byte body", async () => {
    const res = await handleInquiry(post("x".repeat(10241)), FULL_ENV, NOW);
    expect(res.status).toBe(413);
    expectNoSenderCalled();
  });

  it("returns 413 when the Content-Length header exceeds the limit", async () => {
    const res = await handleInquiry(
      post(JSON.stringify(payload()), { "Content-Length": "10241" }),
      FULL_ENV,
      NOW,
    );
    expect(res.status).toBe(413);
    expectNoSenderCalled();
  });

  it("counts UTF-8 bytes, not characters", async () => {
    // 5121 two-byte characters is 10242 bytes but only 5121 characters.
    const res = await handleInquiry(post("é".repeat(5121)), FULL_ENV, NOW);
    expect(res.status).toBe(413);
  });

  it("accepts a body of exactly 10240 bytes up to the JSON stage", async () => {
    const res = await handleInquiry(post("x".repeat(10240)), FULL_ENV, NOW);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ ok: false, error: "invalid_json" });
  });

  it("returns 400 invalid_json for malformed JSON", async () => {
    const res = await handleInquiry(post("{not json"), FULL_ENV, NOW);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ ok: false, error: "invalid_json" });
    expectNoSenderCalled();
  });

  it("returns 400 with errors.name when name is missing", async () => {
    const { name: _name, ...rest } = payload();
    const res = await handleInquiry(post(rest), FULL_ENV, NOW);
    expect(res.status).toBe(400);
    const body = (await res.json()) as { ok: boolean; errors: Record<string, string> };
    expect(body.ok).toBe(false);
    expect(typeof body.errors.name).toBe("string");
    expectNoSenderCalled();
  });

  it("keeps the first issue per field and maps the phone message", async () => {
    const res = await handleInquiry(post(payload({ phone: "12345" })), FULL_ENV, NOW);
    expect(res.status).toBe(400);
    const body = (await res.json()) as { errors: Record<string, string> };
    expect(body.errors.phone).toBe("Enter a valid phone number");
  });
});

describe("handleInquiry spam checks", () => {
  it("fakes success for a filled honeypot without sending", async () => {
    const res = await handleInquiry(post(payload({ website: "x" })), FULL_ENV, NOW);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expectNoSenderCalled();
  });

  it("treats a whitespace-only honeypot as empty", async () => {
    const res = await handleInquiry(post(payload({ website: "   " })), FULL_ENV, NOW);
    expect(res.status).toBe(200);
    expect(sendTelegram).toHaveBeenCalledTimes(1);
  });

  it.each([0, 1000, 2999])("fakes success when fillMs is %i, without sending", async (fillMs) => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await handleInquiry(post(payload({ fillMs })), FULL_ENV, NOW);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expectNoSenderCalled();
  });

  it("sends when fillMs is exactly 3000", async () => {
    const res = await handleInquiry(post(payload({ fillMs: 3000 })), FULL_ENV, NOW);
    expect(res.status).toBe(200);
    expect(sendTelegram).toHaveBeenCalledTimes(1);
  });

  it("sends when the tab was open for three days", async () => {
    const res = await handleInquiry(
      post(payload({ fillMs: 3 * 24 * 3600 * 1000 })),
      FULL_ENV,
      NOW,
    );
    expect(res.status).toBe(200);
    expect(sendTelegram).toHaveBeenCalledTimes(1);
    expect(sendEmail).toHaveBeenCalledTimes(1);
  });

  it.each([-10 * 60 * 1000, 10 * 60 * 1000])(
    "does not depend on the server clock (now shifted by %i ms)",
    async (shift) => {
      const res = await handleInquiry(
        post(payload({ fillMs: 60000 })),
        FULL_ENV,
        new Date(NOW.getTime() + shift),
      );
      expect(res.status).toBe(200);
      expect(sendTelegram).toHaveBeenCalledTimes(1);
      expect(sendEmail).toHaveBeenCalledTimes(1);
    },
  );

  it("returns 400 when fillMs is missing", async () => {
    const { fillMs: _fillMs, ...rest } = payload();
    const res = await handleInquiry(post(rest), FULL_ENV, NOW);
    expect(res.status).toBe(400);
    const body = (await res.json()) as { errors: Record<string, string> };
    expect(typeof body.errors.fillMs).toBe("string");
    expectNoSenderCalled();
  });
});

describe("handleInquiry dropped spam log", () => {
  it.each([
    ["honeypot", { website: "x" }],
    ["too_fast", { fillMs: 1000 }],
  ])("logs a %s drop with the lead id and reason only", async (reason, override) => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await handleInquiry(post(payload(override)), FULL_ENV, NOW);
    expect(error).toHaveBeenCalledTimes(1);
    expect(JSON.parse(String(error.mock.calls[0][0]))).toEqual({
      leadId: ID,
      status: "dropped",
      reason,
    });
    expectNoSenderCalled();

    const ok = await handleInquiry(post(payload()), FULL_ENV, NOW);
    expect(res.status).toBe(ok.status);
    expect(await res.text()).toBe(await ok.clone().text());
    expect(res.headers.get("Content-Type")).toBe(ok.headers.get("Content-Type"));
    expect(res.headers.get("Cache-Control")).toBe(ok.headers.get("Cache-Control"));
  });

  it("logs the honeypot reason when both checks fail", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    await handleInquiry(post(payload({ website: "x", fillMs: 10 })), FULL_ENV, NOW);
    expect(JSON.parse(String(error.mock.calls[0][0])).reason).toBe("honeypot");
  });
});

describe("handleInquiry configuration", () => {
  it("returns 500 not_configured when no channel is configured", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await handleInquiry(post(payload()), {}, NOW);
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ ok: false, error: "not_configured" });
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expectNoSenderCalled();
  });

  it("treats a partially configured email as not configured", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await handleInquiry(
      post(payload()),
      { RESEND_API_KEY: "r", RESEND_FROM: "from@example.com" },
      NOW,
    );
    expect(res.status).toBe(500);
  });

  it("still fakes success for spam when nothing is configured", async () => {
    const res = await handleInquiry(post(payload({ website: "x" })), {}, NOW);
    expect(res.status).toBe(200);
  });

  it("proceeds with only telegram configured", async () => {
    setResults("ok", "skipped");
    const res = await handleInquiry(
      post(payload()),
      { TELEGRAM_BOT_TOKEN: "t", TELEGRAM_CHAT_ID: "c" },
      NOW,
    );
    expect(res.status).toBe(200);
  });
});

describe("handleInquiry logging", () => {
  it("never logs the name or phone on any path", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    setResults("ok", "ok");
    await handleInquiry(post(payload()), FULL_ENV, NOW);
    setResults("failed", "failed");
    await handleInquiry(post(payload()), FULL_ENV, NOW);
    await handleInquiry(post(payload({ website: "x" })), FULL_ENV, NOW);
    await handleInquiry(post(payload()), {}, NOW);
    await handleInquiry(post("{" + NAME + PHONE), FULL_ENV, NOW);

    const logged = [...error.mock.calls, ...log.mock.calls, ...warn.mock.calls]
      .flat()
      .map((arg) => String(arg))
      .join("\n");
    expect(logged).toContain("not_configured");
    expect(logged).not.toContain(NAME);
    expect(logged).not.toContain(PHONE);
    expect(logged).not.toContain("712345678");
  });
});
