# AGENTS.md

## Project

Single-page Google Ads landing page for NuchoSolar (`inquiry.nuchosolar.co.ke`). A visitor fills in a solar inquiry form and the page opens a pre-filled WhatsApp message to the sales number. There is no backend and no database. Stack: Vite 5, React 18, TypeScript, Tailwind 3, shadcn/ui. Scaffolded in Lovable, so `lovable-tagger` is in the dev build.

## Commands

```bash
npm ci
npm run dev        # http://localhost:8080
npm run build      # dist/
npm run lint       # ESLint
npx tsc -p tsconfig.app.json --noEmit
npm start          # node server.cjs, serves dist/ on PORT (default 3000)
```

No test runner is configured. CI does not exist (`.github/` is absent).

## Branch model & deploy

Trunk: everything lands on `main` via PR. Nothing in this repo deploys automatically.

`Dockerfile` (node:18 build, nginx serve), `docker-compose.yml`, `nginx.conf` (`server_name inquiry.nuchosolar.co.ke`) and `server.cjs` are alternative serving options. Which one runs in production is not recorded here; confirm with the operator before changing any of them.

The page is also served as a static copy at `nucho-solar/inquiry-page/` (sibling repo). That copy is this app's `dist/` plus a hand-added `.htaccess` and a Google Ads tag, see below.

## Architecture

- `src/main.tsx` mounts `App.tsx`: React Query, tooltip and toast providers, `BrowserRouter` with `/` and a `*` catch-all. Add routes above the catch-all.
- `src/pages/Index.tsx`: hero, trust sections, and the form anchor `#get-quote`.
- `src/components/InquiryForm.tsx`: the whole product. Controlled form, hand-written validation, device lists per use case (`home`, `office`, `farm`), and `handleSubmit`, which builds the message and calls `window.open` on `https://wa.me/<phone>?text=...`.
- `src/components/ui/`: generated shadcn components. Re-add with the shadcn CLI rather than hand-editing.
- Alias `@` maps to `src/`. Design tokens live in `src/index.css` and `tailwind.config.ts`.

## Environment & Secrets

Both are build-time values compiled into the bundle, so neither is secret.

- `VITE_WHATSAPP_PHONE`: optional. If missing, `InquiryForm.tsx` falls back to the hardcoded `254758330507`. A wrong value silently routes leads to the wrong number.
- `VITE_APP_NAME`: optional, not read by `src/` today.

`.env.example` is the template. Use `.env.local` for local overrides; `*.local` is gitignored.

## Read Before Touching This

### `.env` is tracked
`.env` is committed to git even though `.gitignore` does not list it. Do not read, print or edit it. Untrack it with `git rm --cached .env` and add it to `.gitignore` in a dedicated PR after the operator confirms nothing sensitive was ever in it; if something was, the history needs cleaning too.

### The Google Ads tag is not in this source
The live copy in `nucho-solar/inquiry-page/index.html` contains the gtag snippet for `AW-16856571719`. `index.html` here does not. Building and copying `dist/` over the nucho-solar copy deletes conversion tracking for the ad account. Either add the tag to this `index.html` first, or re-insert it after copying. The nucho-solar copy also carries an `.htaccess` (SPA fallback and cache headers) that `dist/` does not produce.

### No conversion event fires on submit
`handleSubmit` opens WhatsApp but sends no `gtag('event', ...)`. Ad-platform conversions are therefore not counted from the form itself.

### Lint is red on `main`
`npm run lint` reports 3 errors (`no-empty-object-type` in `ui/textarea.tsx` and `ui/command.tsx`, `no-require-imports` in `tailwind.config.ts`) and 7 warnings. Fix the code; do not loosen `eslint.config.js`.

### Dependencies
`npm audit` reports 38 vulnerabilities (1 critical, 29 high, 8 moderate). Not triaged. `node:18` in the Dockerfile is end-of-life.

### Duplicated server files
`server.js` and `server.cjs` are the same Express server except for a comment. `package.json` has `"type": "module"` and `start` runs `server.cjs`; `server.js` uses `require` and would fail under ESM. `deploy:prod` and `deploy:dev` call `upload:*` scripts that do not exist.

## Design source of truth

None yet. Palette and type are whatever `src/index.css` and `tailwind.config.ts` define. The hero uses `backdrop-blur` and a gradient overlay, which `rules/web/` flags. Raise a design-system document as a decision before any visual rework.
