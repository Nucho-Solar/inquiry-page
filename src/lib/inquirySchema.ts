import { z } from "zod";

export const useCases = ["home", "office", "farm"] as const;

export const budgetOptions = [
  "Below KSh 50,000",
  "KSh 50,000 - 100,000",
  "KSh 100,000 - 250,000",
  "KSh 250,000 - 500,000",
  "Above KSh 500,000",
] as const;

// The browser measures the fill time and the function drops anything faster.
export const MIN_FILL_MS = 3000;

// People type +254 0712 345 678, so a 0 after the country code is dropped.
const KENYAN_MOBILE = /^(?:\+?2540?|0)?([71]\d{8})$/;
// Landlines need the 0 or +254 prefix: 020 is Nairobi, 041 is Mombasa.
const KENYAN_LANDLINE = /^(?:\+?2540?|0)([2-6]\d{8})$/;
// Any other country: a + sign, then 8 to 15 digits with no leading 0. +254 is never accepted here.
const INTERNATIONAL = /^\+(?!254)[1-9]\d{7,14}$/;

export function normalizePhone(input: string): string | null {
  const cleaned = input.replace(/[\s\-().]/g, "");
  const kenyan = KENYAN_MOBILE.exec(cleaned) ?? KENYAN_LANDLINE.exec(cleaned);
  if (kenyan) return `+254${kenyan[1]}`;
  return INTERNATIONAL.test(cleaned) ? cleaned : null;
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
    const normalized = normalizePhone(value);
    if (!normalized) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Enter a valid phone number",
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
  fillMs: z.number().int().min(0),
  attribution: attributionSchema.default({}),
});

export type InquiryPayload = z.infer<typeof inquiryPayloadSchema>;
