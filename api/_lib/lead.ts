import type { InquiryPayload } from "../../src/lib/inquirySchema.js";

export type Lead = Omit<InquiryPayload, "website" | "fillMs" | "submissionId"> & {
  id: string;
  receivedAt: string;
};

export function toLead(p: InquiryPayload, now: Date): Lead {
  const { website: _website, fillMs: _fillMs, submissionId, ...rest } = p;
  return { ...rest, id: submissionId, receivedAt: now.toISOString() };
}
