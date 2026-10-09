import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const html = readFileSync(resolve(process.cwd(), "index.html"), "utf8");
const css = readFileSync(resolve(process.cwd(), "src/styles/enquiry.css"), "utf8");

describe("fonts", () => {
  it("are linked from index.html with early connections, not imported by the stylesheet", () => {
    expect(html).toContain('<link rel="preconnect" href="https://fonts.googleapis.com">');
    expect(html).toContain('<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>');
    expect(html).toMatch(
      /<link rel="stylesheet" href="https:\/\/fonts\.googleapis\.com\/css2\?family=DM\+Sans[^"]*family=Outfit[^"]*display=swap">/,
    );
    expect(css).not.toContain("@import");
  });
});
