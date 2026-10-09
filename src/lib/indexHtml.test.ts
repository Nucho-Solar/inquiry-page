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

describe("page title and descriptions", () => {
  const title = "Free Solar Quote in Kenya | Nucho Solar";

  it("name the offer, who it is for and where", () => {
    expect(html).toContain(`<title>${title}</title>`);
    expect(html).toContain(`<meta property="og:title" content="${title}">`);
    expect(html).toContain(`<meta name="twitter:title" content="${title}">`);
    for (const tag of ['name="description"', 'property="og:description"', 'name="twitter:description"']) {
      const match = html.match(new RegExp(`<meta ${tag} content="([^"]*)"`));
      expect(match, tag).not.toBeNull();
      expect(match?.[1]).toMatch(/free solar quote/i);
      expect(match?.[1]).toMatch(/home, office or farm/i);
      expect(match?.[1]).toMatch(/Kenya/);
    }
  });

  it("do not describe the form instead of the offer", () => {
    expect(html).not.toMatch(/Solar Enquiries/);
    expect(html).not.toMatch(/send a short enquiry/i);
  });
});
