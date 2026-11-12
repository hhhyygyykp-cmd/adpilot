# AdPilot

An AI advertising agency app. Customers describe what they want to promote. AdPilot stores the business, interprets the brief, and (in later phases) generates ads.

Phase 1–2 in this tree: accounts, business profiles, conversational briefs. No Runway or paid media calls.

## iPhone app (Xcode)

Open `ios/AdPilot.xcodeproj` in Xcode and press Run. The app talks to the live AdPilot server. Sign in as an administrator to use the Queue tab for Instagram linking and authorization. Customers never connect Instagram. Nothing is posted until Publish is confirmed.

Agency Instagram uses Meta Unified Login (Facebook Login for Business with a configuration id). The OAuth callback is exactly `https://adpilot.apps.grok.bot/api/admin/instagram/callback`. Start Connect while signed in on the hosted app.

Optional Instagram secrets (add in Cursor secrets, never paste values into chat):

- `META_APP_ID` — Meta app ID
- `META_APP_SECRET` — Meta app secret
- `META_CONFIGURATION_ID` — Unified Login configuration id (`config_id`)
- `META_PUBLIC_ORIGIN` — must be `https://adpilot.apps.grok.bot` (OAuth redirect origin and the public HTTPS origin Instagram uses to fetch creatives)

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
- `FAL_GLOBAL_BUDGET_USD` — optional ceiling for all fal spend on this server (defaults to the per-account testing budget so extra signups cannot multiply cost)

## Scripts

- `npm run dev` — development server
- `npm run build` — Next.js build, then `scripts/migrate.mjs` when `DATABASE_URL` is set
