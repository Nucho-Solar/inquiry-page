import { describe, expect, it } from "vitest";
import type { InquiryPayload } from "../../src/lib/inquirySchema.js";
import { escapeHtml, formatEmail, formatTelegram, nairobiTime } from "./format.js";
import { toLead, type Lead } from "./lead.js";

const NOW = new Date("2026-10-08T19:44:00.000Z");

function payload(over: Partial<InquiryPayload> = {}): InquiryPayload {
  return {
    useCase: "home",
    services: ["Solar panels", "Battery storage"],
    name: "Jane Wanjiru",
    phone: "+254712345678",
    location: "Karen",
    budget: "KSh 100,000 - 250,000",
    explanation: "Need backup for the fridge",
    submissionId: "11111111-1111-4111-8111-111111111111",
    website: "",
    formStartedAt: 1,
    attribution: { gclid: "abc", utm_campaign: "nairobi-home" },
    ...over,
  };
}

function lead(over: Partial<InquiryPayload> = {}): Lead {
  return toLead(payload(over), NOW);
}

describe("toLead", () => {
  it("maps submissionId to id, stamps receivedAt, and drops transport fields", () => {
    const l = toLead(payload(), NOW);
    expect(l.id).toBe("11111111-1111-4111-8111-111111111111");
    expect(l.receivedAt).toBe("2026-10-08T19:44:00.000Z");
    expect(l).not.toHaveProperty("website");
    expect(l).not.toHaveProperty("formStartedAt");
    expect(l).not.toHaveProperty("submissionId");
  });
});

describe("nairobiTime", () => {
  it("formats UTC ISO as Nairobi time", () => {
    expect(nairobiTime("2026-10-08T19:44:00.000Z")).toBe("22:44 EAT");
  });
});

describe("escapeHtml", () => {
  it("escapes & < > and double quotes", () => {
    expect(escapeHtml(`<a href="x">&</a>`)).toBe("&lt;a href=&quot;x&quot;&gt;&amp;&lt;/a&gt;");
  });
});

describe("formatTelegram", () => {
  it("matches the layout", () => {
    const { text } = formatTelegram(lead());
    expect(text.split("\n")).toEqual([
      "🔆 New solar lead · Home",
      "",
      "Jane Wanjiru",
      "+254712345678",
      "Karen",
      "KSh 100,000 - 250,000",
      "Solar panels, Battery storage",
      "",
      "Need backup for the fridge",
      "",
      "Google Ads · nairobi-home · 22:44 EAT",
    ]);
  });

  it("omits the notes line when explanation is empty", () => {
    const { text } = formatTelegram(lead({ explanation: "" }));
    expect(text.split("\n")).toEqual([
      "🔆 New solar lead · Home",
      "",
      "Jane Wanjiru",
      "+254712345678",
      "Karen",
      "KSh 100,000 - 250,000",
      "Solar panels, Battery storage",
      "",
      "Google Ads · nairobi-home · 22:44 EAT",
    ]);
  });

  it("uses Direct and omits the campaign when there is no attribution", () => {
    const { text } = formatTelegram(lead({ attribution: {}, explanation: "" }));
    expect(text.endsWith("Direct · 22:44 EAT")).toBe(true);
  });

  it("shows Google Ads without a campaign segment when utm_campaign is absent", () => {
    const { text } = formatTelegram(lead({ attribution: { gclid: "x" }, explanation: "" }));
    expect(text.endsWith("Google Ads · 22:44 EAT")).toBe(true);
  });

  it("builds WhatsApp and Maps buttons", () => {
    const { replyMarkup } = formatTelegram(lead({ location: "Karen & Langata" }));
    const buttons = replyMarkup.inline_keyboard.flat();
    const wa = buttons.find((b) => b.url.startsWith("https://wa.me/"));
    const maps = buttons.find((b) => b.url.startsWith("https://www.google.com/maps/"));
    expect(wa?.url).toBe("https://wa.me/254712345678");
    expect(maps?.url).toBe(
      "https://www.google.com/maps/search/?api=1&query=" +
        encodeURIComponent("Karen & Langata, Kenya"),
    );
  });
});

describe("escaping", () => {
  const hostile = lead({
    name: '<b>Jo</b> & "Co"',
    explanation: "<script>alert(1)</script>",
  });

  it("leaves no raw angle brackets in user content for telegram", () => {
    const { text } = formatTelegram(hostile);
    expect(text).not.toMatch(/[<>]/);
    expect(text).toContain("&lt;");
  });

  it("leaves no raw angle brackets from user content in email html", () => {
    const { html } = formatEmail(hostile);
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<b>Jo</b>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("escapes the plain-text body too", () => {
    const { text } = formatEmail(hostile);
    expect(text).not.toMatch(/[<>]/);
    expect(text).toContain("&lt;");
  });
});

describe("unicode preservation", () => {
  it("keeps emoji, newlines and RTL text", () => {
    const notes = "Hello ☀️🔋\nsecond line\nمرحبا بالعالم";
    expect(formatTelegram(lead({ explanation: notes })).text).toContain(notes);
    expect(formatEmail(lead({ explanation: notes })).text).toContain(notes);
  });
});

describe("formatEmail subject", () => {
  it("matches the spec", () => {
    expect(formatEmail(lead()).subject).toBe(
      "New lead: Jane Wanjiru, Karen (Home, KSh 100,000 - 250,000)",
    );
  });

  it("strips CR and LF from injected names", () => {
    const { subject } = formatEmail(lead({ name: "Eve\r\nBcc: x@y.z" }));
    expect(subject).not.toMatch(/[\r\n]/);
    expect(subject).toContain("Bcc: x@y.z");
  });

  it("truncates long names so the subject stays short", () => {
    const { subject } = formatEmail(lead({ name: "N".repeat(5000), location: "L".repeat(5000) }));
    expect(subject.length).toBeLessThan(200);
  });
});
