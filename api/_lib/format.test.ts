import { describe, expect, it } from "vitest";
import type { InquiryPayload } from "../../src/lib/inquirySchema.js";
import { escapeHtml, formatEmail, formatTelegram, nairobiDateTime } from "./format.js";
import { toLead, type Lead } from "./lead.js";

const NOW = new Date("2026-10-08T19:44:00.000Z");

function payload(over: Partial<InquiryPayload> = {}): InquiryPayload {
  return {
    intent: "system",
    useCase: "home",
    services: ["Solar panels", "Battery storage"],
    installationHelp: false,
    name: "Jane Wanjiru",
    phone: "+254712345678",
    location: "Karen",
    budget: "KSh 100,000 - 250,000",
    explanation: "Need backup for the fridge",
    submissionId: "11111111-1111-4111-8111-111111111111",
    website: "",
    fillMs: 1,
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
    expect(l).not.toHaveProperty("fillMs");
    expect(l).not.toHaveProperty("submissionId");
  });
});

describe("nairobiDateTime", () => {
  it("formats UTC ISO as a Nairobi date and time", () => {
    expect(nairobiDateTime("2026-10-08T19:44:00.000Z")).toBe("8 Oct 22:44 EAT");
  });

  it("moves to the next day when Nairobi is already past midnight", () => {
    expect(nairobiDateTime("2026-12-31T21:30:00.000Z")).toBe("1 Jan 00:30 EAT");
  });
});

describe("escapeHtml", () => {
  it("escapes & < > and double quotes", () => {
    expect(escapeHtml(`<a href="x">&</a>`)).toBe("&lt;a href=&quot;x&quot;&gt;&amp;&lt;/a&gt;");
  });
});

describe("formatTelegram", () => {
  it("shows equipment installation help without an unused budget or setting", () => {
    const { text } = formatTelegram(lead({
      intent: "equipment", useCase: undefined, services: ["Inverter"],
      installationHelp: true, budget: undefined, explanation: "",
    }));
    expect(text).toContain("Solar equipment");
    expect(text).toContain("🔩 Installation help requested");
    expect(text).not.toContain("💰");
    expect(text).not.toContain("🏠");
  });

  it("includes service details and assessment purpose", () => {
    expect(formatTelegram(lead({ intent: "service", serviceType: "repair", services: [] })).text)
      .toContain("🔧 Repair or troubleshoot");
    expect(formatTelegram(lead({ intent: "survey", surveyFor: "project", services: [] })).text)
      .toContain("📋 Business or farm project");
  });

  it("matches the layout", () => {
    const { text } = formatTelegram(lead());
    expect(text.split("\n")).toEqual([
      "🔆 New solar lead · Solar system",
      "👤 Jane Wanjiru",
      "📞 +254712345678",
      "📍 Karen",
      "🏠 Home",
      "💰 KSh 100,000 - 250,000",
      "🛠 Solar panels, Battery storage",
      "📝 Need backup for the fridge",
      "Google Ads · nairobi-home · 8 Oct 22:44 EAT",
    ]);
  });

  it("omits the notes line when explanation is empty", () => {
    const { text } = formatTelegram(lead({ explanation: "" }));
    expect(text.split("\n")).toEqual([
      "🔆 New solar lead · Solar system",
      "👤 Jane Wanjiru",
      "📞 +254712345678",
      "📍 Karen",
      "🏠 Home",
      "💰 KSh 100,000 - 250,000",
      "🛠 Solar panels, Battery storage",
      "Google Ads · nairobi-home · 8 Oct 22:44 EAT",
    ]);
  });

  it("uses Direct and omits the campaign when there is no attribution", () => {
    const { text } = formatTelegram(lead({ attribution: {}, explanation: "" }));
    expect(text.endsWith("Direct · 8 Oct 22:44 EAT")).toBe(true);
  });

  it("shows Google Ads without a campaign segment when utm_campaign is absent", () => {
    const { text } = formatTelegram(lead({ attribution: { gclid: "x" }, explanation: "" }));
    expect(text.endsWith("Google Ads · 8 Oct 22:44 EAT")).toBe(true);
  });

  it.each([
    [{ utm_source: "facebook", utm_medium: "cpc" }, "facebook / cpc · 8 Oct 22:44 EAT"],
    [{ utm_source: "facebook" }, "facebook · 8 Oct 22:44 EAT"],
    [
      { utm_source: "facebook", utm_medium: "cpc", utm_campaign: "launch" },
      "facebook / cpc · launch · 8 Oct 22:44 EAT",
    ],
    [{ utm_medium: "cpc" }, "Direct · 8 Oct 22:44 EAT"],
    [{ gclid: "x", utm_source: "google" }, "Google Ads · 8 Oct 22:44 EAT"],
  ])("shows the campaign source %j", (attribution, expected) => {
    const { text } = formatTelegram(lead({ attribution, explanation: "" }));
    expect(text.endsWith(expected)).toBe(true);
  });

  it("shortens a very long utm_source and escapes it", () => {
    const { text } = formatTelegram(
      lead({ attribution: { utm_source: `<i>${"s".repeat(300)}` }, explanation: "" }),
    );
    const last = text.split("\n").at(-1) as string;
    expect(last).not.toContain("<i>");
    expect(last.length).toBeLessThan(80);
  });

  it("builds WhatsApp and Maps buttons", () => {
    const { replyMarkup } = formatTelegram(lead({ location: "Karen & Langata" }));
    const buttons = replyMarkup.inline_keyboard.flat();
    const wa = buttons.find((b) => b.url.startsWith("https://wa.me/"));
    const maps = buttons.find((b) => b.url.startsWith("https://www.google.com/maps/"));
    expect(buttons.map((b) => b.text)).toEqual(["WhatsApp", "Maps"]);
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

  it("keeps the plain-text body verbatim (text/plain is not parsed as HTML)", () => {
    const { text } = formatEmail(hostile);
    expect(text).toContain('<b>Jo</b> & "Co"');
    expect(text).toContain("<script>alert(1)</script>");
    expect(text).not.toContain("&lt;");
    expect(text).not.toContain("&amp;");
  });

  it("escapes user input in the html part", () => {
    const { html } = formatEmail(hostile);
    expect(html).toContain("&lt;b&gt;Jo&lt;/b&gt; &amp; &quot;Co&quot;");
  });
});

describe("unicode preservation", () => {
  it("keeps emoji, newlines and RTL text", () => {
    const notes = "Hello ☀️🔋\nsecond line\nمرحبا بالعالم";
    expect(formatTelegram(lead({ explanation: notes })).text).toContain(notes);
    expect(formatEmail(lead({ explanation: notes })).text).toContain(notes);
  });
});

describe("formatEmail attribution rows", () => {
  it("includes the gclid and lead id in html and text", () => {
    const l = lead({ attribution: { gclid: "GCL-123" } });
    const { html, text } = formatEmail(l);
    for (const body of [html, text]) {
      expect(body).toContain("GCLID");
      expect(body).toContain("GCL-123");
      expect(body).toContain("Lead ID");
      expect(body).toContain(l.id);
    }
  });

  it("omits the GCLID row when there is no gclid but keeps the lead id", () => {
    const l = lead({ attribution: {} });
    const { html, text } = formatEmail(l);
    for (const body of [html, text]) {
      expect(body).not.toContain("GCLID");
      expect(body).toContain(l.id);
    }
  });
});

describe("formatEmail subject", () => {
  it("matches the spec", () => {
    expect(formatEmail(lead()).subject).toBe(
      "New lead: Jane Wanjiru, Karen (Solar system, KSh 100,000 - 250,000)",
    );
  });

  it("strips CR and LF from injected names", () => {
    const { subject } = formatEmail(lead({ name: "Eve\r\nBcc: x@y.z" }));
    expect(subject).not.toMatch(/[\r\n]/);
    expect(subject).toContain("Bcc: x@y.z");
  });

  it("does not cut an emoji in half when it truncates", () => {
    const { subject } = formatEmail(lead({ name: `${"a".repeat(58)}😀${"b".repeat(20)}` }));
    const loneSurrogate = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;
    expect(loneSurrogate.test(subject)).toBe(false);
    expect(subject).toContain("😀");
  });

  it("truncates long names so the subject stays short", () => {
    const { subject } = formatEmail(lead({ name: "N".repeat(5000), location: "L".repeat(5000) }));
    expect(subject.length).toBeLessThan(200);
  });
});
