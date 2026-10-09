import { describe, expect, it } from "vitest";
import {
  budgetOptions,
  inquiryPayloadSchema,
  isUuid,
  normalizePhone,
} from "./inquirySchema";

describe("normalizePhone", () => {
  it.each([
    "0712 345 678",
    "+254 712-345-678",
    "254712345678",
    "712345678",
    "+254712345678",
  ])("normalizes the Kenyan mobile %s", (input) => {
    expect(normalizePhone(input)).toBe("+254712345678");
  });

  it("accepts numbers starting with 1", () => {
    expect(normalizePhone("0112345678")).toBe("+254112345678");
  });

  it.each([
    "+254 0712 345 678",
    "254 0712345678",
    "0712.345.678",
    "07-12 345 678",
    "(0712) 345 678",
  ])("normalizes the typed Kenyan mobile %s", (input) => {
    expect(normalizePhone(input)).toBe("+254712345678");
  });

  it("drops a stray 0 after +254 on a landline too", () => {
    expect(normalizePhone("+254 020 234 5678")).toBe("+254202345678");
  });

  it.each([
    ["020 234 5678", "+254202345678"],
    ["+254 20 234 5678", "+254202345678"],
    ["041 2345678", "+254412345678"],
  ])("normalizes the Kenyan landline %s", (input, expected) => {
    expect(normalizePhone(input)).toBe(expected);
  });

  it.each([
    ["+1 415 555 0100", "+14155550100"],
    ["+44 20 7946 0958", "+442079460958"],
    ["+1 (415) 555-0100", "+14155550100"],
  ])("keeps the international number %s", (input, expected) => {
    expect(normalizePhone(input)).toBe(expected);
  });

  it.each([
    "07123",
    "",
    "abc",
    "+254 712 3456",
    "+1 555",
    "415 555 0100",
    "+0 123 456 7890",
    "+1234567890123456",
    "+254 0 712 3456",
    "0712 345 6789",
  ])("rejects %j", (input) => {
    expect(normalizePhone(input)).toBeNull();
  });
});

describe("isUuid", () => {
  it("accepts what the payload schema accepts as a submissionId", () => {
    const id = "3f1c2b8e-5a4d-4c6e-9b7a-1d2e3f4a5b6c";
    expect(isUuid(id)).toBe(true);
    expect(inquiryPayloadSchema.shape.submissionId.safeParse(id).success).toBe(true);
  });

  it.each(["", "not-a-uuid", "3f1c2b8e5a4d4c6e9b7a1d2e3f4a5b6c", 42, null, undefined, ["x"]])(
    "rejects %j like the schema does",
    (value) => {
      expect(isUuid(value)).toBe(false);
      expect(inquiryPayloadSchema.shape.submissionId.safeParse(value).success).toBe(false);
    },
  );
});

const validPayload = {
  useCase: "home",
  services: ["Solar lighting", "Phone charging"],
  name: "Jane Wanjiru",
  phone: "0712 345 678",
  location: "Nairobi",
  budget: budgetOptions[0],
  explanation: "Need backup power",
  submissionId: "3f1c2b8e-5a4d-4c6e-9b7a-1d2e3f4a5b6c",
  website: "",
  fillMs: 60000,
  attribution: { gclid: "abc", utm_source: "google" },
};

describe("inquiryPayloadSchema", () => {
  it("accepts a full valid payload and normalizes the phone", () => {
    const result = inquiryPayloadSchema.safeParse(validPayload);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.phone).toBe("+254712345678");
  });

  it.each([
    ["empty services", { services: [] }],
    ["21 services", { services: Array.from({ length: 21 }, (_, i) => `s${i}`) }],
    ["name of 101 chars", { name: "a".repeat(101) }],
    ["explanation of 501 chars", { explanation: "a".repeat(501) }],
    ["budget not in options", { budget: "Free" }],
    ["submissionId not a UUID", { submissionId: "not-a-uuid" }],
    ["negative fillMs", { fillMs: -1 }],
    ["non-integer fillMs", { fillMs: 1500.5 }],
    ["string fillMs", { fillMs: "60000" }],
  ])("rejects %s", (_label, override) => {
    const result = inquiryPayloadSchema.safeParse({ ...validPayload, ...override });
    expect(result.success).toBe(false);
  });

  it("rejects a payload without fillMs", () => {
    const { fillMs: _f, ...rest } = validPayload;
    expect(inquiryPayloadSchema.safeParse(rest).success).toBe(false);
  });

  it("accepts fillMs of 0 and a very large value", () => {
    expect(inquiryPayloadSchema.safeParse({ ...validPayload, fillMs: 0 }).success).toBe(true);
    expect(
      inquiryPayloadSchema.safeParse({ ...validPayload, fillMs: 3 * 24 * 3600 * 1000 }).success,
    ).toBe(true);
  });

  it("defaults explanation and website to empty strings", () => {
    const { explanation: _e, website: _w, ...rest } = validPayload;
    const result = inquiryPayloadSchema.safeParse(rest);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.explanation).toBe("");
      expect(result.data.website).toBe("");
    }
  });
});
