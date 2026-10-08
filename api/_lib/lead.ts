import type { InquiryPayload } from "../../src/lib/inquirySchema.js";

export type Lead = Omit<InquiryPayload, "website" | "formStartedAt" | "submissionId"> & {
  id: string;
  receivedAt: string;
};

export function toLead(p: InquiryPayload, now: Date): Lead {
  const { website: _website, formStartedAt: _formStartedAt, submissionId, ...rest } = p;
  return { ...rest, id: submissionId, receivedAt: now.toISOString() };
}
