import type { InquiryPayload } from "@/lib/inquirySchema";

export type SubmitResult =
  | { ok: true }
  | { ok: false; reason: "validation" | "network" | "server" };

const TIMEOUT_MS = 15000;

// AbortSignal.timeout is missing in older mobile browsers, so fall back to a
// controller with a timer that the caller clears when the request is done.
function timeoutSignal(ms: number): { signal: AbortSignal; clear: () => void } {
  if (typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function") {
    return { signal: AbortSignal.timeout(ms), clear: () => {} };
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return { signal: controller.signal, clear: () => clearTimeout(timer) };
}

export async function submitInquiry(
  payload: InquiryPayload,
  fetchImpl: typeof fetch = fetch,
): Promise<SubmitResult> {
  const { signal, clear } = timeoutSignal(TIMEOUT_MS);
  try {
    const res = await fetchImpl("/api/inquiry", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal,
    });
    if (res.ok) return { ok: true };
    if (res.status === 400) return { ok: false, reason: "validation" };
    return { ok: false, reason: "server" };
  } catch {
    return { ok: false, reason: "network" };
  } finally {
    clear();
  }
}
