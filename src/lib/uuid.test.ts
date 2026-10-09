import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { newId } from "./uuid";

const V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe("newId", () => {
  const realCrypto = globalThis.crypto;

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("uses crypto.randomUUID when it exists", () => {
    vi.stubGlobal("crypto", { randomUUID: () => "11111111-1111-4111-8111-111111111111" });
    expect(newId()).toBe("11111111-1111-4111-8111-111111111111");
  });

  it("builds a v4 uuid from getRandomValues when randomUUID is missing", () => {
    vi.stubGlobal("crypto", {
      getRandomValues: realCrypto.getRandomValues.bind(realCrypto),
    });
    const id = newId();
    expect(id).toMatch(V4);
    expect(z.string().uuid().safeParse(id).success).toBe(true);
  });

  it("sets the version and variant bits on the getRandomValues path", () => {
    vi.stubGlobal("crypto", {
      getRandomValues: <T extends ArrayBufferView>(array: T) => {
        new Uint8Array(array.buffer).fill(0xff);
        return array;
      },
    });
    expect(newId()).toBe("ffffffff-ffff-4fff-bfff-ffffffffffff");
  });

  it("falls back to Math.random when crypto is undefined", () => {
    vi.stubGlobal("crypto", undefined);
    const id = newId();
    expect(id).toMatch(V4);
    expect(z.string().uuid().safeParse(id).success).toBe(true);
  });

  it("returns a different id on each call", () => {
    expect(newId()).not.toBe(newId());
    vi.stubGlobal("crypto", undefined);
    expect(newId()).not.toBe(newId());
  });
});
