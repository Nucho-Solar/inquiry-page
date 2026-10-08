import "@testing-library/jest-dom/vitest";

// Radix Select relies on browser APIs that jsdom does not implement.
// This file also runs under the node environment, so guard on window.
if (typeof window !== "undefined") {
  Element.prototype.hasPointerCapture ??= () => false;
  Element.prototype.releasePointerCapture ??= () => {};
  Element.prototype.scrollIntoView ??= () => {};
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}
