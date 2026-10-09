# Lead Submission and Instant Alerts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the WhatsApp redirect with a server-side submit that alerts the engineer on Telegram and by Resend email within seconds, then forwards the lead to NuchoSolar.

**Architecture:** The form posts JSON to a Vercel function (`api/inquiry.ts`, web-standard `fetch` handler). The function validates with a zod schema shared with the form, runs spam checks, then fans out in parallel to Telegram, Resend and a signed NuchoSolar webhook using plain `fetch`. Success means Telegram or Resend succeeded; the forward never affects the response.

**Tech Stack:** Vite 5, React 18, TypeScript, zod (existing), Vitest, Testing Library, Vercel Functions (Node runtime).

**Spec:** `docs/superpowers/specs/2026-10-08-lead-submission-design.md`

**Preconditions:** PR #1 (`AGENTS.md`) and the spec PR are merged to `main`. Branch `feat/lead-submission` from updated `main`. All commands run in `/home/itsriober/illustriober/inquiry-page`.

## Global Constraints

- Fields unchanged: use case, devices, custom devices, name, phone, location, budget, notes.
- No `window.open` and no `wa.me` redirect for the visitor. `wa.me/<lead phone>` appears only as a Telegram button for the engineer.
- Function: POST only (405 otherwise), JSON only, body at most 10 KB, every outbound call has a 5 second timeout, calls use `fetch` (no SDKs).
- Minimum 3 seconds from page load to submit. Honeypot filled or too fast returns a fake 200 and sends nothing.
- Response: 200 if Telegram or Resend succeeded; 502 if both failed; 500 if neither is configured. The NuchoSolar forward never changes the response.
- Logs carry lead ID and failing channel only. No names or phone numbers.
- Server env (never `VITE_`): `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `RESEND_API_KEY`, `RESEND_FROM`, `LEAD_EMAIL_TO`, `LEADS_WEBHOOK_URL`, `LEADS_WEBHOOK_SECRET`. Browser env, optional: `VITE_CONTACT_PHONE`, `VITE_ADS_CONVERSION_LABEL`.
- Ads tag id `AW-16856571719`. Conversion fires only after a successful submit and only if the label is set.
- Confirmation text promises no response time: "Thanks {name}, we'll contact you on {phone}."
- Resend sends `Idempotency-Key` = lead id. Timestamps shown in Africa/Nairobi.
- Never loosen `eslint.config.js` or any tsconfig. Existing lint errors stay out of this PR.
- Commits: `type(scope): subject`, no AI attribution. Work lands as a PR with the body contract.

## Decisions this plan adds to the spec (confirm on review)

1. The payload carries a client-generated `submissionId` (UUID) that the server uses as the lead id. Without it each retry gets a new id and the Resend idempotency key does nothing.
2. Phone accepts Kenyan mobiles with prefix 7 or 1 (`+2547XXXXXXXX`, `+2541XXXXXXXX`); non-Kenyan numbers are rejected.
3. `@vercel/node` is not needed because the handler uses the web `Request`/`Response` signature. Dev deps are Vitest, jsdom and Testing Library.

## Review Focus

1. A double tap or retry after a timeout must not create two leads: same `submissionId` gives the same lead id and Resend key (Task 3, Task 6).
2. Hostile or odd text (HTML tags, `&`, emoji, newlines, CR/LF in the name) must render inert in Telegram and email and cannot inject email headers (Task 2).
3. Phone formats people really type: `0712 345 678`, `+254 712-345-678`, `254712345678`, `712345678` accepted; `07123`, `+1 555 123 4567` rejected (Task 1).
4. A tab left open for days must still submit; only a `formStartedAt` in the future is treated as spam (Task 4).
5. Upstream non-2xx, thrown errors and timeouts count as a failed channel and never crash the handler (Task 3).

---

### Task 1: Test tooling and shared schema

**Files:**
- Create: `vitest.config.ts`, `src/test/setup.ts`, `src/lib/inquirySchema.ts`, `src/lib/inquirySchema.test.ts`
- Modify: `package.json` (scripts `test`, `typecheck`; dev deps)

**Interfaces:**
- Produces (`src/lib/inquirySchema.ts`):
  - `useCases = ["home","office","farm"] as const`
  - `budgetOptions` (the 5 strings currently in `InquiryForm.tsx`, same order and text, `as const`)
  - `normalizeKenyanPhone(input: string): string | null`
  - `attributionSchema` (optional `gclid`, `utm_source`, `utm_medium`, `utm_campaign`, each string max 200)
  - `inquiryFormSchema`: `useCase`, `services: string[]` (1 to 20 items, each trimmed 1 to 50), `name` (trim, 1 to 100), `phone` (transforms to normalized or adds an issue), `location` (trim, 1 to 100), `budget` (enum of `budgetOptions`), `explanation` (max 500, default `""`)
  - `inquiryPayloadSchema = inquiryFormSchema.extend({ submissionId: uuid, website: string max 200 default "", formStartedAt: int, attribution: attributionSchema default {} })`
  - `type InquiryPayload = z.infer<typeof inquiryPayloadSchema>`

- [ ] **Step 1:** `npm i -D vitest@^2 jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event`. Add scripts `"test": "vitest run"` and `"typecheck": "tsc -p tsconfig.app.json --noEmit"`. `vitest.config.ts`: alias `@` to `src`, default environment `node`, `setupFiles: ["src/test/setup.ts"]`; `setup.ts` imports `@testing-library/jest-dom/vitest`. Component tests opt in with `// @vitest-environment jsdom`.
- [ ] **Step 2: Write failing tests** in `inquirySchema.test.ts`:
  - `normalizeKenyanPhone` returns `+254712345678` for `0712 345 678`, `+254 712-345-678`, `254712345678`, `712345678`, `+254712345678`; returns `+254112345678` for `0112345678`; returns `null` for `07123`, `+1 555 123 4567`, `""`.
  - `inquiryPayloadSchema` accepts a full valid payload and outputs the normalized phone.
  - Rejects: empty `services`, 21 services, name of 101 chars, `explanation` of 501 chars, budget not in `budgetOptions`, `submissionId` not a UUID.
  - `explanation` defaults to `""`; `website` defaults to `""`.
- [ ] **Step 3:** Run `npx vitest run src/lib/inquirySchema.test.ts`. Expected: FAIL (module missing).
- [ ] **Step 4:** Implement `inquirySchema.ts` per the Interfaces. The file imports only `zod`, nothing browser-specific, because `api/` imports it.
- [ ] **Step 5:** Run `npm test` and `npm run typecheck`. Expected: all tests pass, tsc clean.
- [ ] **Step 6:** Commit `git add -A && git commit -m "feat(schema): add shared inquiry schema and test tooling"`.

### Task 2: Lead model and message formatting

**Files:**
- Create: `api/_lib/lead.ts`, `api/_lib/format.ts`, `api/_lib/format.test.ts`, `tsconfig.api.json`
- Modify: `package.json` (`typecheck` also runs `tsc -p tsconfig.api.json --noEmit`), `tsconfig.json` (add reference)

**Interfaces:**
- Consumes: `InquiryPayload` from `../../src/lib/inquirySchema.js`.
- Produces:
  - `type Lead = Omit<InquiryPayload,"website"|"formStartedAt"|"submissionId"> & { id: string; receivedAt: string }` (`receivedAt` ISO)
  - `toLead(p: InquiryPayload, now: Date): Lead` (`id = p.submissionId`)
  - `nairobiTime(iso: string): string` returning e.g. `22:44 EAT`
  - `escapeHtml(s: string): string` (`& < >` and `"`)
  - `formatTelegram(lead: Lead): { text: string; replyMarkup: { inline_keyboard: { text: string; url: string }[][] } }`
  - `formatEmail(lead: Lead): { subject: string; html: string; text: string }`

`tsconfig.api.json`: `strict: true`, `module: ESNext`, `moduleResolution: bundler`, `lib: [ES2022, DOM]`, `types: ["node"]`, `noEmit`, include `api` and `src/lib`. Relative imports inside `api/` use explicit `.js` extensions (Node ESM, `"type": "module"`).

- [ ] **Step 1: Write failing tests** in `format.test.ts`:
  - Telegram text matches the spec layout: first line `🔆 New solar lead · Home`, then name, phone, location, budget, services joined by `, `, and a footer `Google Ads · <utm_campaign> · 22:44 EAT`; the notes line is absent when `explanation` is `""`.
  - Buttons: WhatsApp url `https://wa.me/254712345678` (no `+`), Maps url starts `https://www.google.com/maps/search/?api=1&query=` with the URL-encoded location.
  - Escaping: name `<b>Jo</b> & "Co"` and notes `<script>alert(1)</script>` contain no raw `<` or `>` in the Telegram text, the email html, or the text body (`&lt;` present).
  - Emoji, newlines and a right-to-left string in notes survive unchanged apart from escaping.
  - Email subject equals `New lead: Jane Wanjiru, Karen (Home, KSh 100,000 - 250,000)`; a name containing `\r\nBcc: x@y.z` yields a subject with no `\r` or `\n`.
  - `nairobiTime("2026-10-08T19:44:00.000Z")` equals `22:44 EAT`.
- [ ] **Step 2:** Run `npx vitest run api/_lib/format.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement `lead.ts` and `format.ts`. Use `Intl.DateTimeFormat("en-GB",{timeZone:"Africa/Nairobi",hour:"2-digit",minute:"2-digit",hour12:false})` for the time. Use "Direct" as the source when `utm_campaign` is absent, and `Google Ads` when `gclid` is present.
- [ ] **Step 4:** Run `npm test` and `npm run typecheck`. Expected: pass.
- [ ] **Step 5:** Commit `feat(api): add lead model and alert formatting`.

### Task 3: Channel senders and signing

**Files:**
- Create: `api/_lib/sign.ts`, `api/_lib/channels.ts`, `api/_lib/channels.test.ts`

**Interfaces:**
- Consumes: `Lead`, `formatTelegram`, `formatEmail`.
- Produces:
  - `hmacSha256Hex(key: string, message: string): string` (Node `crypto`)
  - `signPayload(secret: string, timestamp: string, body: string): string` = `hmacSha256Hex(secret, `${timestamp}.${body}`)`
  - `type Env = Record<string, string | undefined>`
  - `type ChannelResult = { channel: "telegram" | "email" | "forward"; status: "ok" | "failed" | "skipped" }`
  - `CHANNEL_TIMEOUT_MS = 5000`
  - `sendTelegram(lead: Lead, env: Env): Promise<ChannelResult>`, `sendEmail(lead: Lead, env: Env): Promise<ChannelResult>`, `forwardLead(lead: Lead, env: Env, now?: Date): Promise<ChannelResult>`. None ever rejects.

Request shapes: Telegram `POST https://api.telegram.org/bot<token>/sendMessage` with JSON `{chat_id, text, parse_mode:"HTML", reply_markup, disable_web_page_preview:true}`. Resend `POST https://api.resend.com/emails`, `Authorization: Bearer`, JSON `{from, to: LEAD_EMAIL_TO split on commas, subject, html, text}`, header `Idempotency-Key: lead.id`. Forward `POST LEADS_WEBHOOK_URL`, body `JSON.stringify(lead)`, headers `X-Timestamp` (unix seconds) and `X-Signature: sha256=<signPayload>`. Each call uses `AbortSignal.timeout(CHANNEL_TIMEOUT_MS)`.

- [ ] **Step 1: Write failing tests** (stub global `fetch` with `vi.stubGlobal`):
  - `hmacSha256Hex("Jefe","what do ya want for nothing?")` equals `5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843` (RFC 4231 case 2).
  - Telegram: missing token or chat id gives `skipped` with no fetch call; 200 gives `ok` and the request URL/body match; 429 gives `failed`; a thrown `TypeError` gives `failed`; an `AbortError` gives `failed`.
  - Email: request carries `Idempotency-Key` equal to `lead.id` and `to` split from `a@x.com, b@x.com`; missing `RESEND_API_KEY` gives `skipped`; 422 gives `failed`.
  - Forward: missing `LEADS_WEBHOOK_URL` gives `skipped`; sent `X-Signature` equals `sha256=` + `signPayload(secret, X-Timestamp, body)`; 500 gives `failed`.
  - No result object or log line contains the lead's name or phone.
- [ ] **Step 2:** Run `npx vitest run api/_lib/channels.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement `sign.ts` and `channels.ts`. Any non-2xx, thrown error or timeout maps to `failed`; on failure `console.error(JSON.stringify({leadId, channel, status}))` and nothing else.
- [ ] **Step 4:** Run `npm test` and `npm run typecheck`. Expected: pass.
- [ ] **Step 5:** Commit `feat(api): add telegram, resend and signed forward senders`.

### Task 4: The `/api/inquiry` handler

**Files:**
- Create: `api/inquiry.ts`, `api/inquiry.test.ts`

**Interfaces:**
- Consumes: `inquiryPayloadSchema`, `toLead`, `sendTelegram`, `sendEmail`, `forwardLead`, `Env`.
- Produces:
  - `handleInquiry(request: Request, env: Env, now?: Date): Promise<Response>`
  - `export default { fetch: (request: Request) => handleInquiry(request, process.env) }`
  - JSON bodies: `200 {ok:true}`; `400 {ok:false,errors:Record<string,string>}` (or `{ok:false,error:"invalid_json"}`); `405`; `413`; `415`; `500 {ok:false,error:"not_configured"}`; `502 {ok:false,error:"delivery_failed"}`.

Order: method, content-type, body size (UTF-8 bytes at most 10240), JSON parse, schema, spam (honeypot non-empty, or `now - formStartedAt < 3000`, or `formStartedAt > now + 60000`) returning fake `200 {ok:true}` with nothing sent, config check (neither Telegram nor Resend fully configured gives 500), `toLead`, `Promise.all` of the three senders, response rule. A `formStartedAt` older than 3 seconds by any margin is valid.

- [ ] **Step 1: Write failing tests** (mock `./_lib/channels.js` with `vi.mock`; helper builds a valid `Request` with `formStartedAt` 60 s before `now`):
  - valid post with Telegram `ok` and email `failed` returns 200; both `failed` returns 502; Telegram `skipped` and email `ok` returns 200.
  - forward `failed` with Telegram `ok` still returns 200.
  - GET returns 405; `text/plain` returns 415; 10241-byte body returns 413; malformed JSON returns 400 `invalid_json`; missing name returns 400 with `errors.name`.
  - honeypot `website: "x"` returns 200 and no sender called; `formStartedAt = now - 1000` returns 200 and no sender called; `formStartedAt = now + 120000` returns 200 and no sender called.
  - `formStartedAt = now - 3 * 24 * 3600 * 1000` is accepted and senders are called.
  - env with no Telegram and no Resend config returns 500 and no sender called.
  - the lead passed to the senders has `id` equal to the payload's `submissionId`.
  - no `console.error` call includes the name or phone.
- [ ] **Step 2:** Run `npx vitest run api/inquiry.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement per the Interfaces. Read the body with `request.text()` and measure with `new TextEncoder().encode(text).length`. Zod issues map to `errors[path[0]] = message`.
- [ ] **Step 4:** Run `npm test` and `npm run typecheck`. Expected: pass.
- [ ] **Step 5:** Commit `feat(api): add inquiry endpoint with spam checks and fan-out`.

### Task 5: Client submit, attribution and conversion helpers

**Files:**
- Create: `src/lib/submitInquiry.ts`, `src/lib/attribution.ts`, `src/lib/trackConversion.ts`, `src/lib/client.test.ts`
- Modify: `src/vite-env.d.ts` (declare `window.gtag`)

**Interfaces:**
- Consumes: `InquiryPayload`.
- Produces:
  - `submitInquiry(payload: InquiryPayload, fetchImpl?: typeof fetch): Promise<{ ok: true } | { ok: false; reason: "validation" | "network" | "server" }>` posting JSON to `/api/inquiry` (400 gives `validation`, 5xx gives `server`, thrown fetch gives `network`)
  - `readAttribution(search: string): Attribution` picking `gclid`, `utm_source`, `utm_medium`, `utm_campaign` and dropping everything else
  - `trackConversion(label: string | undefined, gtag?: Window["gtag"]): void` calling `gtag("event","conversion",{send_to:`AW-16856571719/${label}`})` only when both exist

- [ ] **Step 1: Write failing tests** in `client.test.ts`: `submitInquiry` maps 200, 400, 502 and a thrown error to the four results; `readAttribution("?gclid=abc&utm_campaign=solar&foo=bar")` returns only the two known keys; `trackConversion(undefined, spy)` does not call the spy; `trackConversion("L1", spy)` calls it with `send_to: "AW-16856571719/L1"`; a missing `gtag` does not throw.
- [ ] **Step 2:** Run `npx vitest run src/lib/client.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement the three modules.
- [ ] **Step 4:** Run `npm test` and `npm run typecheck`. Expected: pass.
- [ ] **Step 5:** Commit `feat(form): add submit, attribution and conversion helpers`.

### Task 6: Form UI

**Files:**
- Create: `src/components/InquirySuccess.tsx`, `src/components/InquiryForm.test.tsx`
- Modify: `src/components/InquiryForm.tsx`

**Interfaces:**
- Consumes: `inquiryFormSchema`, `budgetOptions`, `submitInquiry`, `readAttribution`, `trackConversion`.
- Produces: `InquirySuccess({ name, phone }: { name: string; phone: string })` rendering "Thanks {name}, we'll contact you on {phone}."

Changes to `InquiryForm.tsx`: import `budgetOptions` from the schema file; replace `validateForm` with `inquiryFormSchema.safeParse` (issue path `services` shown as the existing `devices` error; phone message becomes "Enter a Kenyan mobile number, e.g. 0712 345 678"; other messages unchanged); replace the WhatsApp block in `handleSubmit` with `submitInquiry`; keep the device-label mapping. Add `submissionId` (`crypto.randomUUID()` held in a ref) and `formStartedAt` (`Date.now()` held in a ref at mount). Add a honeypot input named `website`: visually hidden, `tabIndex={-1}`, `aria-hidden="true"`, `autoComplete="off"`. While sending, the button is disabled and reads "Sending…". On success call `trackConversion(import.meta.env.VITE_ADS_CONVERSION_LABEL)` and render `InquirySuccess`. On failure keep all state and show an inline message with a `tel:` link to `VITE_CONTACT_PHONE` (default `254758330507`, as today). The button label changes from "Send Inquiry via WhatsApp" to "Request My Free Quote".

- [ ] **Step 1: Write failing tests** (`// @vitest-environment jsdom`, mock `@/lib/submitInquiry`, spy on `window.open`):
  - filling a valid form and submitting shows "Thanks Jane, we'll contact you on +254712345678." and the form is gone; `window.open` was never called.
  - `submitInquiry` resolving `{ok:false,reason:"server"}` keeps the typed name and location in the inputs and shows a link whose `href` is `tel:` plus the contact phone.
  - double clicking submit calls `submitInquiry` once and the button is disabled while pending.
  - the payload passed to `submitInquiry` has `website: ""`, a UUID `submissionId`, a numeric `formStartedAt`, and `attribution` equal to `readAttribution(window.location.search)` (set the URL to `?gclid=abc&utm_campaign=solar` and assert both keys arrive); a retry after failure reuses the same `submissionId`.
  - invalid phone `07123` shows the new phone message and does not call `submitInquiry`.
  - the honeypot input is `aria-hidden` and has `tabindex="-1"`.
- [ ] **Step 2:** Run `npx vitest run src/components/InquiryForm.test.tsx`. Expected: FAIL.
- [ ] **Step 3:** Implement per the Interfaces. Reuse the existing classes and tokens; no visual redesign.
- [ ] **Step 4:** Run `npm test`, `npm run typecheck` and `npm run build`. Expected: all pass, build succeeds.
- [ ] **Step 5:** Commit `feat(form): submit to api and show confirmation instead of whatsapp redirect`.

### Task 7: Config, tracking tag, CI and docs

**Files:**
- Create: `vercel.json`, `.github/workflows/ci.yml`, `src/lib/vercelRewrite.test.ts`
- Modify: `index.html`, `.env.example`, `AGENTS.md`, `LOCAL_SETUP.md`

- [ ] **Step 1: Write failing test** `vercelRewrite.test.ts`: read `vercel.json`, build a `RegExp` from the first rewrite's `source` anchored with `^` and `$`; `/` and `/anything` match; `/api/inquiry` does not.
- [ ] **Step 2:** Run it. Expected: FAIL (no `vercel.json`).
- [ ] **Step 3:** `vercel.json`: one rewrite, source `/((?!api/).*)`, destination `/index.html`. `index.html`: add the gtag snippet for `AW-16856571719` exactly as in `nucho-solar/inquiry-page/index.html`. `.env.example`: replace `VITE_WHATSAPP_PHONE` with `VITE_CONTACT_PHONE`, add `VITE_ADS_CONVERSION_LABEL`, and list the server variables as comments marked "set in Vercel, never `VITE_`". `ci.yml`: on pull_request and push to `main`, Node 20, runs `npm ci`, `npm run typecheck`, `npm test`, `npm run build` (no lint step until the existing lint errors are fixed). `AGENTS.md`: update Project, Architecture, Environment & Secrets and Read Before Touching This (remove the Ads-tag and WhatsApp-number warnings that no longer apply). `LOCAL_SETUP.md`: replace the WhatsApp section with the submit flow and `vercel dev` note.
- [ ] **Step 4:** Run `npm test`, `npm run typecheck`, `npm run build`. Expected: pass; `grep -c AW-16856571719 dist/index.html` prints `2`.
- [ ] **Step 5:** Commit `chore(config): add vercel rewrite, ads tag, ci and docs`.

### Task 8: Final verification and PR

- [ ] **Step 1:** Run `npm ci && npm run typecheck && npm test && npm run build`. Record test file and test counts.
- [ ] **Step 2:** Run `npm run lint` and record that the same 3 pre-existing errors remain and no new ones were added.
- [ ] **Step 3:** `git push -u origin feat/lead-submission`; open the PR titled `feat(api): submit inquiries to a server endpoint with telegram and email alerts` using the body contract. `## Unverified` lists: no real Telegram or Resend call made, not deployed to Vercel, function not exercised on a preview URL, no browser check at 1440 and 390, rate-limit rule not set. `## Deployment` lists the five operator steps from the spec. Add `Implements: docs/superpowers/specs/2026-10-08-lead-submission-design.md`. Assign to `Itsriober`, label `enhancement`. End with the `Reviewed by:` line once a fresh-context review has run.
