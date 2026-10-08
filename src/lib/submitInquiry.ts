import type { InquiryPayload } from "@/lib/inquirySchema";

export type SubmitResult =
  | { ok: true }
  | { ok: false; reason: "validation" | "network" | "server" };

export async function submitInquiry(
  payload: InquiryPayload,
  fetchImpl: typeof fetch = fetch,
): Promise<SubmitResult> {
  try {
    const res = await fetchImpl("/api/inquiry", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.ok) return { ok: true };
    if (res.status === 400) return { ok: false, reason: "validation" };
    return { ok: false, reason: "server" };
  } catch {
    return { ok: false, reason: "network" };
  }
}
