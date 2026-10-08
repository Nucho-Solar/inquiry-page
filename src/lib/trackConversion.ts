const ADS_ACCOUNT = "AW-16856571719";

export function trackConversion(
  label: string | undefined,
  gtag: Window["gtag"] = typeof window !== "undefined" ? window.gtag : undefined,
): void {
  if (!label || !gtag) return;
  try {
    gtag("event", "conversion", { send_to: `${ADS_ACCOUNT}/${label}` });
  } catch {
    // Analytics must never break the submit flow.
  }
}
