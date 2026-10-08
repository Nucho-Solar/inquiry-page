import { z } from "zod";

export const useCases = ["home", "office", "farm"] as const;

export const budgetOptions = [
  "Below KSh 50,000",
  "KSh 50,000 - 100,000",
  "KSh 100,000 - 250,000",
  "KSh 250,000 - 500,000",
  "Above KSh 500,000",
] as const;

const KENYAN_PHONE = /^(?:\+?254|0)?([71]\d{8})$/;

export function normalizeKenyanPhone(input: string): string | null {
  const cleaned = input.replace(/[\s\-()]/g, "");
  const match = KENYAN_PHONE.exec(cleaned);
  return match ? `+254${match[1]}` : null;
}

export const attributionSchema = z.object({
  gclid: z.string().max(200).optional(),
  utm_source: z.string().max(200).optional(),
  utm_medium: z.string().max(200).optional(),
  utm_campaign: z.string().max(200).optional(),
});

export const inquiryFormSchema = z.object({
  useCase: z.enum(useCases),
  services: z.array(z.string().trim().min(1).max(50)).min(1).max(20),
  name: z.string().trim().min(1).max(100),
  phone: z.string().transform((value, ctx) => {
    const normalized = normalizeKenyanPhone(value);
    if (!normalized) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Enter a valid Kenyan phone number",
      });
      return z.NEVER;
    }
    return normalized;
  }),
  location: z.string().trim().min(1).max(100),
  budget: z.enum(budgetOptions),
  explanation: z.string().max(500).default(""),
});

export const inquiryPayloadSchema = inquiryFormSchema.extend({
  submissionId: z.string().uuid(),
  website: z.string().max(200).default(""),
  formStartedAt: z.number().int(),
  attribution: attributionSchema.default({}),
});

export type InquiryPayload = z.infer<typeof inquiryPayloadSchema>;
