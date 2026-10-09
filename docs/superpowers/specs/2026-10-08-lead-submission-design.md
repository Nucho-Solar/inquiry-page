# Lead submission and instant alerts: design

Part 1 of 2. Part 2 (a leads module and admin dashboard in `nucho-solar`) gets its own spec.

## Problem

`InquiryForm.tsx` builds a WhatsApp message and calls `window.open` on `wa.me`. There is no server. A lead exists only if the visitor completes the WhatsApp send, and the engineer has no alert and no record. The Google Ads conversion never fires.

## Goal

A visitor submits the form and stays on the page. The engineer is alerted on his phone within seconds with everything needed to follow up. Every lead leaves a record. Leads can later be tracked in the NuchoSolar dashboard (Part 2).

## Decisions

Each was confirmed one at a time on 2026-10-08.

1. Instant alert goes to a Telegram bot, posting to the engineer and owner group.
2. Resend email is the second channel and the record.
3. The endpoint is a Vercel function in this repo (`api/inquiry.ts`). The inquiry subdomain's DNS moves to Vercel.
4. Lead tracking lives in the NuchoSolar dashboard (Part 2), not here. No database in this repo.
5. Approach A: the function fans out to Telegram and Resend, then forwards to NuchoSolar best-effort. Alerts never depend on the NuchoSolar host.
6. The visitor's confirmation promises no response time.

## Form and visitor flow

- Fields unchanged: use case, devices, custom devices, name, phone, location, budget, notes.
- `src/lib/inquirySchema.ts` (zod) is the single schema, imported by the form and by the function. The server re-validates and normalises the phone to `+2547XXXXXXXX`.
- Submit disables the button, shows "Sending…", and POSTs JSON to `/api/inquiry`. No `window.open`, no `wa.me`.
- Success replaces the form with "Thanks {name}, we'll contact you on {phone}."
- Failure keeps the entered values and shows an inline message with a `tel:` link to `VITE_CONTACT_PHONE`.
- The form measures fill time with `performance.now()` (monotonic, so a wrong device clock cannot affect it) from mount to submit and sends it as `fillMs`.
- The page URL's `gclid` and `utm_*` values are captured and sent with the lead.
- The `AW-16856571719` gtag snippet moves into `index.html`. On success only, the page fires a conversion event using `VITE_ADS_CONVERSION_LABEL`; if unset, no event fires.
- `VITE_WHATSAPP_PHONE` is renamed `VITE_CONTACT_PHONE` and used only for the failure link.

## Function: `api/inquiry.ts`

In order:

1. POST only (405 otherwise), JSON only, body at most 10 KB.
2. Validate with the shared schema; 400 with field errors.
3. Spam: hidden honeypot field (filled returns a fake 200 and sends nothing); minimum fill time, where the browser sends `fillMs` and the function drops the lead when `fillMs < 3000`, so the server never reads a client wall clock; a dropped submission is logged with the lead id and the reason (`honeypot` or `too_fast`) only; per-IP rate limit enforced by a Vercel Firewall rule (operator step, proposed default 5 per 10 minutes).
4. Build the lead: UUID, Nairobi timestamp, `gclid`, `utm_*`.
5. In parallel, each with a 5 second timeout, via `fetch` (no SDKs):
   - Telegram `sendMessage`, HTML parse mode, all fields escaped, with inline buttons WhatsApp (`wa.me/<lead phone>`) and Maps.
   - Resend `POST /emails`, HTML and text bodies, `Idempotency-Key` set to the lead UUID.
   - Forward to `LEADS_WEBHOOK_URL`: JSON body, headers carry a timestamp and an HMAC-SHA256 signature over timestamp and body with `LEADS_WEBHOOK_SECRET`. Skipped while the URL is unset.
6. Response: 200 if Telegram or Resend succeeded; 502 if both failed. The forward never changes the response.
7. Logs carry the lead ID and failing channel only. No names or phone numbers.

If neither Telegram nor Resend is configured, the function returns 500 instead of reporting success.

### Telegram message

```
🔆 New solar lead · Home
👤 Jane Wanjiru
📞 +254712345678
📍 Karen, Nairobi
💰 KSh 100,000 - 250,000
🛠 Backup Inverter, CCTV Cameras
📝 <notes, omitted if empty>
Google Ads · <utm_campaign> · 22:44 EAT
```

Email subject: `New lead: Jane Wanjiru, Karen (Home, KSh 100,000 - 250,000)`. Body repeats the details plus `gclid` and lead ID. No customer confirmation email: the form collects no email address.

## Environment

Server-only (Vercel), never `VITE_`:

| Variable | If missing |
|---|---|
| `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` | Telegram skipped, error logged |
| `RESEND_API_KEY`, `RESEND_FROM`, `LEAD_EMAIL_TO` | Email skipped, error logged |
| `LEADS_WEBHOOK_URL`, `LEADS_WEBHOOK_SECRET` | NuchoSolar forward skipped |

Browser, optional: `VITE_CONTACT_PHONE`, `VITE_ADS_CONVERSION_LABEL`.

## Files

- New: `api/inquiry.ts`, `src/lib/inquirySchema.ts`, `api/_lib/` helpers (telegram, resend, forward, format), `vercel.json` (SPA rewrite that excludes `/api`), tests.
- Changed: `src/components/InquiryForm.tsx`, `index.html`, `.env.example`, `AGENTS.md`, `package.json` (Vitest, Testing Library, jsdom, `@vercel/node` types).

## Testing

No test runner exists today, so Vitest is added.

- Schema: phone normalisation and rejection, length caps, required fields.
- Handler with mocked `fetch`: both channels succeed; one fails (200); both fail (502); honeypot (fake 200, nothing sent); too fast; non-POST (405); oversized body; both unconfigured (500); forward failure leaves the response unchanged; HMAC signature verifies against a known vector.
- Formatting: HTML in name, location or notes is escaped in the Telegram and email bodies.
- Form (Testing Library): success panel appears, failure keeps values and shows the call link, `window.open` is never called.
- Manual, before DNS moves: a real test lead on the Vercel preview URL. Confirm the Telegram message, the email, and the confirmation screen at 1440 and 390 widths.
- CI: new `.github/workflows/ci.yml` running `npm ci`, `tsc`, `npm test`, `npm run build`. `npm run lint` joins once its 3 existing errors are fixed in a separate PR.

## Operator steps (go in the PR's `## Deployment`)

1. Create the Telegram bot with BotFather, add it to the group, note the chat ID.
2. Verify the sending domain in Resend; create an API key.
3. Link the repo to a Vercel project; set the env vars above.
4. Add the Firewall rate-limit rule.
5. Send a test lead on the preview URL; then move the inquiry subdomain's DNS.

## Out of scope

- The leads dashboard and the receiving endpoint in `nucho-solar` (Part 2).
- Removing `Dockerfile`, `docker-compose.yml`, `nginx.conf`, `server.js`, `server.cjs` (follow-up after DNS cutover).
- Untracking `.env`, fixing lint errors, triaging `npm audit` (separate PRs).
- SMS fallback, WhatsApp Business API, a customer confirmation email, any visual redesign.
