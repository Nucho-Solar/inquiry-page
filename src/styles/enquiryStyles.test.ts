import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(resolve(process.cwd(), "src/styles/enquiry.css"), "utf8");

// The enquiry window is drawn in a portal, outside .enquiry-page, so the colours the buttons use
// must be declared for the window too. Otherwise Continue and Get my free quote lose their colour.
describe("enquiry colours", () => {
  it("are declared for the landing page and for the window", () => {
    const declaration = css.split("}").find((block) => block.includes("--enquiry-yellow:"));
    expect(declaration).toBeDefined();
    const selectors = (declaration as string).split("{")[0];
    expect(selectors).toContain(".enquiry-page");
    expect(selectors).toContain(".enquiry-dialog");
  });
});

// On a phone the number is dropped from the button to save room, but a screen reader must still say it.
describe("header call button on small screens", () => {
  it("hides the number by clipping it, never with display: none", () => {
    const rule = css.split("}").find((block) => block.includes(".enquiry-header-number"));
    expect(rule).toBeDefined();
    expect(rule).not.toMatch(/display:\s*none/);
    expect(rule).toMatch(/clip/);
  });
});
