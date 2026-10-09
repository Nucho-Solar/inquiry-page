// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { InquiryPayload } from "@/lib/inquirySchema";
import { readAttribution } from "@/lib/attribution";
import { submitInquiry } from "@/lib/submitInquiry";
import { trackConversion } from "@/lib/trackConversion";

const payload: InquiryPayload = {
  useCase: "home",
  services: ["Solar panels"],
  name: "Jane",
  phone: "+254712345678",
  location: "Nairobi",
  budget: "Below KSh 50,000",
  explanation: "",
  submissionId: "3b241101-e2bb-4255-8caf-4136c566a962",
  website: "",
  fillMs: 60000,
  attribution: {},
};

const respond = (status: number, body = '{"ok":true}') =>
  vi.fn().mockResolvedValue(new Response(body, { status }));

describe("submitInquiry", () => {
  it("posts JSON to /api/inquiry", async () => {
    const fetchImpl = respond(200);
    await submitInquiry(payload, fetchImpl);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe("/api/inquiry");
    expect(init.method).toBe("POST");
    expect(init.headers).toEqual({ "Content-Type": "application/json" });
    expect(init.body).toBe(JSON.stringify(payload));
  });

  it("maps 200 to ok", async () => {
    expect(await submitInquiry(payload, respond(200))).toEqual({ ok: true });
  });

  it.each([
    ["an empty body", ""],
    ["an HTML page", "<html>Sign in to the Wi-Fi</html>"],
    ["an object without ok", "{}"],
    ["ok set to false", '{"ok":false}'],
    ["ok as a string", '{"ok":"true"}'],
  ])("maps a 200 with %s to server", async (_label, body) => {
    expect(await submitInquiry(payload, respond(200, body))).toEqual({
      ok: false,
      reason: "server",
    });
  });

  it("maps 400 to validation", async () => {
    expect(await submitInquiry(payload, respond(400))).toEqual({
      ok: false,
      reason: "validation",
    });
  });

  it.each([502, 500, 413, 415, 405, 429])("maps %i to server", async (status) => {
    expect(await submitInquiry(payload, respond(status))).toEqual({
      ok: false,
      reason: "server",
    });
  });

  it("maps a thrown fetch to network without rejecting", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new TypeError("offline"));
    expect(await submitInquiry(payload, fetchImpl)).toEqual({
      ok: false,
      reason: "network",
    });
  });
});

describe("submitInquiry timeout", () => {
  const originalTimeout = AbortSignal.timeout;

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    AbortSignal.timeout = originalTimeout;
  });

  it("passes an abort signal to fetch", async () => {
    const fetchImpl = respond(200);
    await submitInquiry(payload, fetchImpl);
    expect(fetchImpl.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
  });

  it("uses AbortSignal.timeout(15000) when available", async () => {
    const spy = vi.spyOn(AbortSignal, "timeout");
    await submitInquiry(payload, respond(200));
    expect(spy).toHaveBeenCalledWith(15000);
  });

  it.each(["TimeoutError", "AbortError"])("maps a %s rejection to network", async (name) => {
    const fetchImpl = vi.fn().mockRejectedValue(new DOMException("aborted", name));
    expect(await submitInquiry(payload, fetchImpl)).toEqual({
      ok: false,
      reason: "network",
    });
  });

  describe("without AbortSignal.timeout", () => {
    beforeEach(() => {
      // Simulate an older browser without AbortSignal.timeout.
      (AbortSignal as { timeout?: unknown }).timeout = undefined;
      vi.useFakeTimers();
    });

    const hangingFetch = () =>
      vi.fn(
        (_url: string, init: RequestInit) =>
          new Promise<Response>((_resolve, reject) => {
            init.signal?.addEventListener("abort", () =>
              reject(new DOMException("aborted", "AbortError")),
            );
          }),
      );

    it("resolves to network after 15 seconds when fetch never answers", async () => {
      const fetchImpl = hangingFetch();
      let result: unknown;
      const pending = submitInquiry(payload, fetchImpl as unknown as typeof fetch).then((r) => {
        result = r;
      });
      await vi.advanceTimersByTimeAsync(14999);
      expect(result).toBeUndefined();
      await vi.advanceTimersByTimeAsync(1);
      await pending;
      expect(result).toEqual({ ok: false, reason: "network" });
    });

    it("clears its timer once the request completes", async () => {
      await submitInquiry(payload, respond(200));
      expect(vi.getTimerCount()).toBe(0);
    });

    it("clears its timer when fetch rejects", async () => {
      await submitInquiry(payload, vi.fn().mockRejectedValue(new TypeError("offline")));
      expect(vi.getTimerCount()).toBe(0);
    });
  });
});

describe("readAttribution", () => {
  it("keeps only known keys", () => {
    expect(readAttribution("?gclid=abc&utm_campaign=solar&foo=bar")).toEqual({
      gclid: "abc",
      utm_campaign: "solar",
    });
  });

  it("drops empty values and returns an empty object for no params", () => {
    expect(readAttribution("?gclid=&utm_source=g")).toEqual({ utm_source: "g" });
    expect(readAttribution("")).toEqual({});
  });

  it("truncates values to 200 characters", () => {
    const result = readAttribution(`?gclid=${"a".repeat(300)}`);
    expect(result.gclid).toHaveLength(200);
  });

  it("reads all four known keys", () => {
    expect(
      readAttribution("?gclid=g&utm_source=s&utm_medium=m&utm_campaign=c"),
    ).toEqual({ gclid: "g", utm_source: "s", utm_medium: "m", utm_campaign: "c" });
  });
});

describe("trackConversion", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    delete window.gtag;
  });

  it("does nothing without a label", () => {
    const spy = vi.fn();
    trackConversion(undefined, spy);
    trackConversion("", spy);
    expect(spy).not.toHaveBeenCalled();
  });

  it("calls gtag with the conversion send_to", () => {
    const spy = vi.fn();
    trackConversion("L1", spy);
    expect(spy).toHaveBeenCalledWith("event", "conversion", {
      send_to: "AW-16856571719/L1",
    });
  });

  it("defaults to window.gtag", () => {
    const spy = vi.fn();
    window.gtag = spy;
    trackConversion("L1");
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("does not throw when gtag is missing", () => {
    expect(() => trackConversion("L1")).not.toThrow();
    expect(() => trackConversion("L1", undefined)).not.toThrow();
  });

  it("does not throw when window is missing", () => {
    vi.stubGlobal("window", undefined);
    expect(() => trackConversion("L1")).not.toThrow();
  });

  it("swallows errors thrown by gtag", () => {
    const spy = vi.fn(() => {
      throw new Error("blocked");
    });
    expect(() => trackConversion("L1", spy)).not.toThrow();
    expect(spy).toHaveBeenCalled();
  });
});
