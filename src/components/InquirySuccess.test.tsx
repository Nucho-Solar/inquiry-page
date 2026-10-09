// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import InquirySuccess from "@/components/InquirySuccess";

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
});

describe("InquirySuccess", () => {
  it("thanks the visitor by name and says what happens next and when", () => {
    render(<InquirySuccess name="Jane Wanjiru" phone="+254712345678" />);
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("Thanks, Jane Wanjiru.");
    expect(status).toHaveTextContent("We'll call or WhatsApp you on +254712345678 within 24 hours.");
  });

  it("lets the visitor reach Nucho Solar sooner by call or WhatsApp", () => {
    render(<InquirySuccess name="Jane" phone="+254712345678" />);
    expect(screen.getByRole("link", { name: "Call 0758 330 507" })).toHaveAttribute("href", "tel:+254758330507");
    expect(screen.getByRole("link", { name: "WhatsApp" })).toHaveAttribute("href", "https://wa.me/254758330507");
  });

  it("uses the configured contact number", () => {
    vi.stubEnv("VITE_CONTACT_PHONE", "254700111222");
    render(<InquirySuccess name="Jane" phone="+254712345678" />);
    expect(screen.getByRole("link", { name: "Call 0700 111 222" })).toHaveAttribute("href", "tel:+254700111222");
    expect(screen.getByRole("link", { name: "WhatsApp" })).toHaveAttribute("href", "https://wa.me/254700111222");
  });
});
