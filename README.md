# AdPilot

An AI advertising agency app. Customers describe what they want to promote. AdPilot stores the business, interprets the brief, and (in later phases) generates ads.

Phase 1–2 in this tree: accounts, business profiles, conversational briefs. No Runway or paid media calls.

## iPhone app

Open `ios/AdPilot.xcodeproj` in Xcode on a Mac, select your team, and run it on a phone or simulator. The app talks to the hosted API at `https://adpilot.apps.grok.bot`. That host must be public, or the phone is stopped by Cursor’s sign-in gate. Change `baseURL` in `ios/AdPilot/APIClient.swift` if the API moves.

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
