import { afterEach, describe, expect, it, vi } from "vitest";
import { callHref, contactDigits, formatPhone, whatsappHref } from "./contact";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("contactDigits", () => {
  it("falls back to the Nucho Solar number when none is configured", () => {
    vi.stubEnv("VITE_CONTACT_PHONE", "");
    expect(contactDigits()).toBe("254758330507");
  });

  it("keeps only the digits of a configured number", () => {
    vi.stubEnv("VITE_CONTACT_PHONE", "+254 700-111-222");
    expect(contactDigits()).toBe("254700111222");
  });

  it("falls back when the configured value has no digits", () => {
    vi.stubEnv("VITE_CONTACT_PHONE", "call us");
    expect(contactDigits()).toBe("254758330507");
  });
});

describe("formatPhone", () => {
  it("shows a Kenyan number the way people dial it", () => {
    expect(formatPhone("254758330507")).toBe("0758 330 507");
  });

  it("shows any other number with a plus sign", () => {
    expect(formatPhone("14155550100")).toBe("+14155550100");
  });
});

describe("links", () => {
  it("builds a call link and a WhatsApp link from the digits", () => {
    expect(callHref("254758330507")).toBe("tel:+254758330507");
    expect(whatsappHref("254758330507")).toBe("https://wa.me/254758330507");
  });
});
