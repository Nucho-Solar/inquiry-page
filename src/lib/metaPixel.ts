const PIXEL_ID = /^\d{8,20}$/;
const SDK_URL = "https://connect.facebook.net/en_US/fbevents.js";

// Loads Meta's fbevents.js and records the page view. A missing or malformed
// id loads nothing, so an unset VITE_META_PIXEL_ID means no Meta request is made.
export function initMetaPixel(
  pixelId: string | undefined,
  win: Window = window,
  doc: Document = document,
): void {
  if (!pixelId || !PIXEL_ID.test(pixelId) || win.fbq) return;
  try {
    const queue: unknown[][] = [];
    const fbq = ((...args: unknown[]) => {
      if (fbq.callMethod) fbq.callMethod(...args);
      else queue.push(args);
    }) as NonNullable<Window["fbq"]>;
    fbq.queue = queue;
    fbq.loaded = true;
    fbq.version = "2.0";
    fbq.push = fbq;
    win.fbq = fbq;
    win._fbq = fbq;
    const script = doc.createElement("script");
    script.async = true;
    script.src = SDK_URL;
    doc.head.appendChild(script);
    fbq("init", pixelId);
    fbq("track", "PageView");
  } catch {
    // Analytics must never break the page.
  }
}

// `eventId` is the submission id, so a later server-side Conversions API call
// can send the same id and Meta counts the lead once.
export function trackLead(
  pixelId: string | undefined,
  eventId: string,
  fbq: Window["fbq"] = typeof window !== "undefined" ? window.fbq : undefined,
): void {
  if (!pixelId || !PIXEL_ID.test(pixelId) || !fbq) return;
  try {
    fbq("track", "Lead", {}, { eventID: eventId });
  } catch {
    // Analytics must never break the submit flow.
  }
}
