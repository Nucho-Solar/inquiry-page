// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { initMetaPixel, trackLead } from "@/lib/metaPixel";

function resetPixel() {
  delete window.fbq;
  delete window._fbq;
  document.head.querySelectorAll("script").forEach((s) => s.remove());
}

describe("initMetaPixel", () => {
  afterEach(resetPixel);

  it.each([undefined, "", "abc", "123", "1234567890123456789012", "123456789<script>"])(
    "loads nothing for the id %s",
    (id) => {
      initMetaPixel(id);
      expect(window.fbq).toBeUndefined();
      expect(document.head.querySelector("script")).toBeNull();
    },
  );

  it("loads fbevents.js and queues init and PageView for a valid id", () => {
    initMetaPixel("123456789012345");
    expect(document.head.querySelector("script")?.getAttribute("src")).toBe(
      "https://connect.facebook.net/en_US/fbevents.js",
    );
    expect(window.fbq?.queue).toEqual([
      ["init", "123456789012345"],
      ["track", "PageView"],
    ]);
  });

  it("does not load twice", () => {
    initMetaPixel("123456789012345");
    initMetaPixel("123456789012345");
    expect(document.head.querySelectorAll("script")).toHaveLength(1);
  });
});

describe("trackLead", () => {
  it("does nothing without a valid pixel id", () => {
    const spy = vi.fn();
    trackLead(undefined, "id-1", spy as never);
    trackLead("nope", "id-1", spy as never);
    expect(spy).not.toHaveBeenCalled();
  });

  it("sends Lead with the submission id as eventID", () => {
    const spy = vi.fn();
    trackLead("123456789012345", "id-1", spy as never);
    expect(spy).toHaveBeenCalledWith("track", "Lead", {}, { eventID: "id-1" });
  });

  it("does not throw when fbq is missing or blocked", () => {
    expect(() => trackLead("123456789012345", "id-1")).not.toThrow();
    const spy = vi.fn(() => {
      throw new Error("blocked");
    });
    expect(() => trackLead("123456789012345", "id-1", spy as never)).not.toThrow();
  });
});
