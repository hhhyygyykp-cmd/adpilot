# AdPilot

An AI advertising agency app. Customers describe what they want to promote. AdPilot stores the business, interprets the brief, and (in later phases) generates ads.

Phase 1–2 in this tree: accounts, business profiles, conversational briefs. No Runway or paid media calls.

## iPhone Simulator

Open `ios/AdPilot.xcodeproj` in Xcode and press Run. A Debug run uses `http://127.0.0.1:3000` on this Mac. The iOS Simulator shares the Mac’s network, and the dev server listens on `127.0.0.1` only, so the app uses that address rather than `localhost`. Release builds still use `https://adpilot.apps.grok.bot` and do not make that site public.

Start the server first, in the repo folder:

```bash
npm run dev
npm run demo
```

Sign in with the account printed by `npm run demo`. Paid generation stays off.

This copy does not publish to Instagram or Facebook, and it does not invent ad analytics.

## Run locally

```bash
npm install
env -u DATABASE_URL npm run dev
```

Open http://127.0.0.1:3000

When `DATABASE_URL` is unset the app uses PGlite (file-backed under `data/pglite`). Production Postgres is provisioned on publish via `cursor-app.json`.

Optional:

- `ADMIN_EMAILS` — comma-separated administrator emails (never auto-promotes the first user)
- `OPENAI_API_KEY` — optional LLM interpretation; without it a structured conversation engine is used

## Scripts

- `npm run dev` — development server
- `npm run build` — Next.js build, then `scripts/migrate.mjs` when `DATABASE_URL` is set
