const DEFAULT_DIGITS = "254758330507";

// The number shown to visitors. Only the digits are kept, so +254 700-111-222 and 254700111222 are the same.
export function contactDigits(value: string | undefined = import.meta.env.VITE_CONTACT_PHONE): string {
  const digits = (value ?? "").replace(/\D/g, "");
  if (!digits) return DEFAULT_DIGITS;
  // tel: and wa.me links need the international form, so 0758 330 507 and 758 330 507 become 254758330507.
  if (/^0[17]\d{8}$/.test(digits)) return `254${digits.slice(1)}`;
  if (/^[17]\d{8}$/.test(digits)) return `254${digits}`;
  return digits;
}

// A Kenyan number is shown the way people dial it: 0758 330 507.
export function formatPhone(digits: string): string {
  if (digits.startsWith("254") && digits.length === 12) {
    const local = `0${digits.slice(3)}`;
    return `${local.slice(0, 4)} ${local.slice(4, 7)} ${local.slice(7)}`;
  }
  return `+${digits}`;
}

export const callHref = (digits: string): string => `tel:+${digits}`;
export const whatsappHref = (digits: string): string => `https://wa.me/${digits}`;
