# AGENTS.md

## Project

Single-page Google Ads landing page for NuchoSolar (`inquiry.nuchosolar.co.ke`), hosted on Vercel. A visitor fills in a solar inquiry form and stays on the page. The `api/inquiry.ts` Vercel function alerts the engineer through Telegram and Resend email, and forwards the lead to NuchoSolar when that is configured. There is no database. Stack: Vite 5 SPA, React 18, TypeScript, Tailwind 3, shadcn/ui, plus the Vercel function. Scaffolded in Lovable, so `lovable-tagger` is in the dev build.

## Commands

```bash
npm ci
npm run dev        # http://localhost:8080
npm run build      # dist/
npm run lint       # ESLint
npm test           # Vitest, needs Node >= 22.22
npm run typecheck  # tsc for src/ (tsconfig.app.json) and api/ (tsconfig.api.json)
npm start          # legacy: node server.cjs, serves dist/ on PORT (default 3000)
```

CI (`.github/workflows/ci.yml`) runs `npm ci`, typecheck, tests and build on Node 22 for every PR and push to `main`. It has no lint step until the lint errors below are fixed.

## Branch model & deploy

Trunk: everything lands on `main` via PR. The Vercel project deploys from GitHub, with a preview per PR and production from `main`. `vercel.json` has one rewrite that sends every path except `/api/*` to `index.html`.

`Dockerfile` (node:18 build, nginx serve), `docker-compose.yml`, `nginx.conf` and `server.cjs` / `server.js` are legacy, pending cutover and removal. DNS for `inquiry.nuchosolar.co.ke` moves to Vercel at cutover; that is an operator step. Confirm with the operator before changing or deleting the legacy files.

The copy at `nucho-solar/inquiry-page/` (sibling repo) is the OLD WhatsApp-redirect build plus a hand-added `.htaccess` and a Google Ads tag. This build needs the `/api/inquiry` Vercel function, so never copy its `dist/` into `nucho-solar`: every submission would hit a missing endpoint and show the failure message.

## Architecture

- `src/main.tsx` mounts `App.tsx`: React Query, tooltip and toast providers, `BrowserRouter` with `/` and a `*` catch-all. Add routes above the catch-all.
- `src/pages/Index.tsx`: hero, trust sections, and the form anchor `#get-quote`.
- `src/components/InquiryForm.tsx`: the form. Validates with `src/lib/inquirySchema.ts`, device lists per use case (`home`, `office`, `farm`), hidden `website` honeypot field, and submits through `src/lib/submitInquiry.ts`. On success it renders `InquirySuccess.tsx`; on failure it shows a tap-to-call link.
- `src/lib/`: `inquirySchema.ts` (zod schema, phone normalisation for Kenyan mobiles, Kenyan landlines and `+` international numbers, and `MIN_FILL_MS`, shared with the function), `submitInquiry.ts` (POST to `/api/inquiry`, 15 s timeout), `uuid.ts` (`newId`, a `crypto.randomUUID` fallback), `attribution.ts` (UTM and `gclid` capture), `trackConversion.ts` (Google Ads conversion event).
- `api/inquiry.ts`: the Vercel function. Validates, drops bots, builds a lead, then sends Telegram and email alerts and the optional forward. Helpers in `api/_lib/`: `config.ts` (which channels are configured), `lead.ts`, `format.ts` (message text), `channels.ts` (Telegram, Resend, forward; the Resend `Idempotency-Key` is the lead id plus a hash of the email content, so a corrected resubmission is not refused with 409), `sign.ts` (forward signature). Types for `api/` come from `tsconfig.api.json`.
- `src/components/ui/`: generated shadcn components. Re-add with the shadcn CLI rather than hand-editing.
- Alias `@` maps to `src/`. Design tokens live in `src/index.css` and `tailwind.config.ts`.

## Environment & Secrets

Server variables are set in Vercel project settings and are read only by `api/inquiry.ts`. Never prefix them with `VITE_`, which would compile them into the public bundle.

- `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`: both required for Telegram. If either is missing, the Telegram alert is skipped and logged with the lead id and channel only.
- `RESEND_API_KEY`, `RESEND_FROM`, `LEAD_EMAIL_TO`: all required for email. If any is missing, the email alert is skipped and logged with the lead id and channel only.
- If both channels are unconfigured, the endpoint returns 500 and leads are rejected loudly instead of vanishing.
- `LEADS_WEBHOOK_URL`, `LEADS_WEBHOOK_SECRET`: both required to forward leads to NuchoSolar. If either is missing, the forward skips silently.

Browser variables are compiled into the bundle, so neither is secret.

- `VITE_CONTACT_PHONE`: optional, default `254758330507`. Only used for the tap-to-call link shown when sending fails. A wrong value sends visitors to the wrong number.
- `VITE_ADS_CONVERSION_LABEL`: optional. Unset means no Google Ads conversion event is sent.
- `VITE_APP_NAME`: optional, not read by `src/` today.

`.env.example` is the template. Use `.env.local` for local overrides; `*.local` is gitignored.

## Read Before Touching This

### `.env` is tracked
`.env` is committed to git even though `.gitignore` does not list it. Do not read, print or edit it. Untrack it with `git rm --cached .env` and add it to `.gitignore` in a dedicated PR after the operator confirms nothing sensitive was ever in it; if something was, the history needs cleaning too.

### Lint is red on `main`
`npm run lint` reports 3 errors (`no-empty-object-type` in `ui/textarea.tsx` and `ui/command.tsx`, `no-require-imports` in `tailwind.config.ts`) and 7 warnings. Fix the code; do not loosen `eslint.config.js`.

### Dependencies
`npm audit` reports 38 vulnerabilities (1 critical, 29 high, 8 moderate). Not triaged. `node:18` in the Dockerfile is end-of-life.

### Duplicated server files (legacy)
Both are legacy, pending cutover to Vercel. `server.js` and `server.cjs` are the same Express server except for a comment. `package.json` has `"type": "module"` and `start` runs `server.cjs`; `server.js` uses `require` and would fail under ESM. `deploy:prod` and `deploy:dev` call `upload:*` scripts that do not exist.

### Alerts must never depend on NuchoSolar
The forward to NuchoSolar is best-effort. A failure or timeout there must not change the response to the visitor or delay the Telegram and email alerts. `handleInquiry` hands the forward to `waitUntil` from `@vercel/functions` and does not await it, so the runtime can finish it after the response. The forward starts with the alerts, so a lead the visitor was told failed (502) can still reach NuchoSolar, and a retry reuses the same lead id: the receiver must dedupe by `id`.

### Honeypot and timing
The hidden `website` field and the 3-second minimum fill time are what drop bots. The form measures fill time with `performance.now()` and sends `fillMs`; the function drops the lead when `fillMs < 3000`. Both checks run before schema validation, so a bot that sends bad fields still gets the fake 200 instead of a 400 that names the fields. The server never compares a client timestamp with its own clock, because a visitor's wrong device clock would silently drop a real lead. A bot submission gets a fake 200 on purpose, so nothing tells the sender it was dropped; the drop is logged as `{leadId, status: "dropped", reason}` (`honeypot` or `too_fast`; `leadId` is null when the body has no valid UUID) so a surge of dropped real leads is visible. A browser that autofills `website` silently drops a real lead, so keep the field hidden from autofill (`autoComplete="off"`, `tabIndex={-1}`). The form sends no Google Ads conversion when `website` is filled or `fillMs < MIN_FILL_MS` (exported from `inquirySchema.ts`), because the server fakes success for exactly those submissions.

### Logs carry no personal data
Function logs record the lead id and the channel only. Never log names, phone numbers, emails or message bodies.

## Design source of truth

None yet. Palette and type are whatever `src/index.css` and `tailwind.config.ts` define. The hero uses `backdrop-blur` and a gradient overlay, which `rules/web/` flags. Raise a design-system document as a decision before any visual rework.
