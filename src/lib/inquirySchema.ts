import { z } from "zod";

export const useCases = ["home", "office", "farm"] as const;
export const inquiryIntents = ["system", "equipment", "service", "survey", "unsure"] as const;
export const serviceTypes = ["repair", "maintenance", "upgrade", "reinstallation"] as const;
export const surveyPurposes = ["new", "upgrade", "project", "unknown"] as const;

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

// The same test the payload schema applies to submissionId, for code that has not validated a body yet.
export const isUuid = (value: unknown): value is string => z.string().uuid().safeParse(value).success;

export const attributionSchema = z.object({
  gclid: z.string().max(200).optional(),
  utm_source: z.string().max(200).optional(),
  utm_medium: z.string().max(200).optional(),
  utm_campaign: z.string().max(200).optional(),
});

const inquiryFields = z.object({
  // A default keeps an already-open copy of the previous form valid during a deployment.
  intent: z.enum(inquiryIntents).default("system"),
  useCase: z.enum(useCases).optional(),
  services: z.array(z.string().trim().min(1).max(50)).max(20).default([]),
  serviceType: z.enum(serviceTypes).optional(),
  surveyFor: z.enum(surveyPurposes).optional(),
  installationHelp: z.boolean().default(false),
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
  // Older form submissions include a budget; the shorter enquiry does not ask for one.
  budget: z.enum(budgetOptions).optional(),
  explanation: z.string().max(500).default(""),
});

function validateInquiry(value: z.infer<typeof inquiryFields>, ctx: z.RefinementCtx) {
  const add = (path: string, message: string) => ctx.addIssue({ code: z.ZodIssueCode.custom, path: [path], message });
  if (value.intent === "system" && !value.useCase) add("useCase", "Select where the system will be used");
  if ((value.intent === "system" || value.intent === "equipment") && value.services.length === 0) {
    add("services", "Add at least one item");
  }
  if (value.intent === "service" && !value.serviceType) add("serviceType", "Select the work needed");
  if (value.intent === "survey" && !value.surveyFor) add("surveyFor", "Select what needs assessing");
  if ((value.intent === "service" || value.intent === "unsure") && value.explanation.trim().length < 5) {
    add("explanation", "Add a short description");
  }
}

export const inquiryFormSchema = inquiryFields.superRefine(validateInquiry);

export const inquiryPayloadSchema = inquiryFields.extend({
  submissionId: z.string().uuid(),
  website: z.string().max(200).default(""),
  fillMs: z.number().int().min(0),
  attribution: attributionSchema.default({}),
}).superRefine(validateInquiry);

export type InquiryPayload = z.infer<typeof inquiryPayloadSchema>;
