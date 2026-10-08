import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const config = JSON.parse(
  readFileSync(new URL("../../vercel.json", import.meta.url), "utf8"),
) as { rewrites: { source: string; destination: string }[] };

describe("vercel.json SPA rewrite", () => {
  const [rewrite] = config.rewrites;
  const pattern = new RegExp(`^${rewrite.source}$`);

  it("sends the root and app routes to index.html", () => {
    expect(rewrite.destination).toBe("/index.html");
    expect(pattern.test("/")).toBe(true);
    expect(pattern.test("/anything")).toBe(true);
    expect(pattern.test("/some/deep/route")).toBe(true);
  });

  it("leaves the api routes alone", () => {
    expect(pattern.test("/api/inquiry")).toBe(false);
  });
});
