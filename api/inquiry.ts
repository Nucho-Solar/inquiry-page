import { waitUntil } from "@vercel/functions";
import { inquiryPayloadSchema, MIN_FILL_MS } from "../src/lib/inquirySchema.js";
import { forwardLead, sendEmail, sendTelegram } from "./_lib/channels.js";
import { hasEmail, hasTelegram, type Env } from "./_lib/config.js";
import { toLead } from "./_lib/lead.js";

const MAX_BODY_BYTES = 10240;

function json(status: number, body: unknown, extraHeaders: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      ...extraHeaders,
    },
  });
}

export async function handleInquiry(
  request: Request,
  env: Env,
  now: Date = new Date(),
  defer: (work: Promise<unknown>) => void = waitUntil,
): Promise<Response> {
  if (request.method !== "POST") {
    return json(405, { ok: false, error: "method_not_allowed" }, { Allow: "POST" });
  }

  const contentType = request.headers.get("Content-Type") ?? "";
  if (!contentType.toLowerCase().startsWith("application/json")) {
    return json(415, { ok: false, error: "unsupported_media_type" });
  }

  const declaredLength = Number(request.headers.get("Content-Length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    return json(413, { ok: false, error: "payload_too_large" });
  }
  const text = await request.text();
  if (new TextEncoder().encode(text).length > MAX_BODY_BYTES) {
    return json(413, { ok: false, error: "payload_too_large" });
  }

  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return json(400, { ok: false, error: "invalid_json" });
  }

  const parsed = inquiryPayloadSchema.safeParse(raw);
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0];
      if (typeof field === "string" && !(field in errors)) errors[field] = issue.message;
    }
    return json(400, { ok: false, errors });
  }
  const payload = parsed.data;

  // Bots get the same success response as people, and nothing is sent. The fill
  // time is measured by the browser with a monotonic clock, so no client wall
  // clock is ever compared with the server clock. Drops are logged by id only.
  const dropReason =
    payload.website.trim() !== "" ? "honeypot" : payload.fillMs < MIN_FILL_MS ? "too_fast" : null;
  if (dropReason) {
    console.error(JSON.stringify({ leadId: payload.submissionId, status: "dropped", reason: dropReason }));
    return json(200, { ok: true });
  }

  if (!hasTelegram(env) && !hasEmail(env)) {
    console.error(JSON.stringify({ error: "not_configured" }));
    return json(500, { ok: false, error: "not_configured" });
  }

  const lead = toLead(payload, now);
  // The forward to NuchoSolar is best effort: the visitor's response and the alerts never wait
  // for it. defer() lets the runtime keep it running after the response is sent.
  defer(forwardLead(lead, env, now).then(() => undefined, () => undefined));
  const [telegram, email] = await Promise.all([sendTelegram(lead, env), sendEmail(lead, env)]);

  if (telegram.status === "ok" || email.status === "ok") return json(200, { ok: true });
  return json(502, { ok: false, error: "delivery_failed" });
}

export default {
  fetch: (request: Request) => handleInquiry(request, process.env),
};
