import type { z } from "zod";
import type { attributionSchema } from "@/lib/inquirySchema";

export type Attribution = z.infer<typeof attributionSchema>;

const KEYS = ["gclid", "utm_source", "utm_medium", "utm_campaign"] as const;
const MAX_LENGTH = 200;

export function readAttribution(search: string): Attribution {
  const params = new URLSearchParams(search);
  const result: Attribution = {};
  for (const key of KEYS) {
    const value = params.get(key);
    if (value) result[key] = value.slice(0, MAX_LENGTH);
  }
  return result;
}
