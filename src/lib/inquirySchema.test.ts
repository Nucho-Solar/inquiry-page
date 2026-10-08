import { describe, expect, it } from "vitest";
import {
  budgetOptions,
  inquiryPayloadSchema,
  normalizeKenyanPhone,
} from "./inquirySchema";

describe("normalizeKenyanPhone", () => {
  it.each([
    "0712 345 678",
    "+254 712-345-678",
    "254712345678",
    "712345678",
    "+254712345678",
  ])("normalizes %s", (input) => {
    expect(normalizeKenyanPhone(input)).toBe("+254712345678");
  });

  it("accepts numbers starting with 1", () => {
    expect(normalizeKenyanPhone("0112345678")).toBe("+254112345678");
  });

  it.each(["07123", "+1 555 123 4567", ""])("rejects %j", (input) => {
    expect(normalizeKenyanPhone(input)).toBeNull();
  });
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
  formStartedAt: 1760000000000,
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
  ])("rejects %s", (_label, override) => {
    const result = inquiryPayloadSchema.safeParse({ ...validPayload, ...override });
    expect(result.success).toBe(false);
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
