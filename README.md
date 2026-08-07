# Calorie Tracker (飲食熱量追蹤)

A Hong Kong–style calorie tracking dashboard with a photo-based AI estimator. Built for family use — multi-user, mobile-first, PWA-ready.

**Stack:** React + Vite + Tailwind CSS 4 · Cloudflare Pages (frontend) · Cloudflare Workers + D1 (API) · Workers AI (vision)

## Features

- 📊 **Daily / weekly / monthly views** — calories vs. personal budget (TDEE-based)
- 🍱 **HK food catalog** — portion-based kcal with P/C/F macros (雲吞麵, 燒味飯, 茶記 items…)
- 📷 **Vision estimate** — snap a meal photo, AI (Workers AI **Gemma 4 26B**) returns itemized foods + kcal, grounded in your catalog; editable before saving
- 📝 **Text estimate** — describe the meal in Cantonese, get the same structured estimate
- 👥 **Multi-user** — JWT auth (jose + bcryptjs), each user's data isolated
- ⚖️ **Weight tracking** with profile (TDEE, goal)
- 🌗 Light / dark mode

## Architecture

```
React PWA (CF Pages) ──► Worker API (CF Workers) ──► D1 (calorielog)
                              │
                              └──► Workers AI (Gemma 4 26B) for /api/vision
```

- Frontend talks only to the Worker API (Bearer JWT). **No static data snapshot is served** — `public/diet-data.json` is a build-time placeholder; real data always comes from the API.
- Wiki ↔ D1 sync scripts (BK's personal pipeline) live in `scripts/` — see `autosync.sh`.

## Local development

```bash
npm install
cp .env.example .env    # fill in values, see below
npm run dev             # Vite dev server (frontend only)
```

The frontend defaults to the **deployed** API (`calorie-api.baronjetso.workers.dev`). To run the Worker locally against remote D1:

```bash
npx wrangler dev --remote --port 8790
```

## Cloudflare setup (deploy your own instance)

### 1. D1 database

```bash
npx wrangler d1 create calorielog
# put the returned database_id into wrangler.toml [[d1_databases]]
npx wrangler d1 execute calorielog --remote --file=schema.sql
```

### 2. Worker secrets

```bash
npx wrangler secret put ADMIN_KEY      # required — admin key maps to user 1 (BK)
# optional: GEMINI_API_KEY is NOT used anymore (vision runs on Workers AI);
# remove it if present: npx wrangler secret delete GEMINI_API_KEY
```

`ADMIN_KEY` unlocks the `x-admin-key` header routes used by the sync scripts (`/api/admin/...`). All other users register via the app.

### 3. Deploy

```bash
npx wrangler deploy                    # Worker → calorie-api.<your-subdomain>.workers.dev
npm run build && npx wrangler pages deploy dist --project-name=<name>
```

Point the frontend at your Worker by editing `src/lib/api.js` → `API_BASE`.

### 4. Vision (Workers AI)

`/api/vision` uses the `[ai]` binding — no extra config. It calls `@cf/google/gemma-4-26b-a4b-it` (free-tier friendly, Cloudflare-hosted, no region restrictions). The first call may auto-trigger the model license agreement via Workers AI.

> **Why not Gemini API directly?** Google's Gemini API doesn't serve Hong Kong–region egress IPs (Cloudflare Workers run in HKG POPs), returning `400 User location is not supported`. Workers AI is Cloudflare-hosted so it sidesteps this entirely.

## Scripts

| Script | Purpose |
|---|---|
| `scripts/sync.mjs` | Wiki (`~/wiki/general/health/diet/`) → `public/diet-data.json` (build snapshot) |
| `scripts/pull.mjs` | D1 → wiki (dashboard edits flow back) |
| `scripts/push.mjs` | Wiki → D1 (admin-key authed) |
| `scripts/autosync.sh` | 30-min cron pipeline: pull → sync → push |
| `scripts/test-vision.mjs` | Smoke-test `/api/vision` (text + image) |

## Privacy notes

- `.env` (CF token, admin key, passwords) is gitignored — **never commit it**.
- `public/diet-data.json` is a placeholder in git; `git update-index --skip-worktree public/diet-data.json` keeps real synced data out of `git status`. Re-run after cloning if you sync locally.
- Real diet data lives in D1 and the wiki — not in the repo.

## License

Private / family use. Reach out to the owner for permissions.
