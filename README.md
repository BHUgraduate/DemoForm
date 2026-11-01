# Soundlane — music release submission demo with a Google Sheet control panel

> **A client demonstration, not a distributor.** It proves this loop end to end:
> **artist submits a release → backend + database → admin dashboard → Google Sheet → admin edits Status in the sheet → backend poller → database → artist dashboard.**
> Docs: [`GOOGLE_SHEETS_SETUP.md`](GOOGLE_SHEETS_SETUP.md) · [`GOOGLE_SHEETS_ARCHITECTURE.md`](GOOGLE_SHEETS_ARCHITECTURE.md) · [`DEMO_ROADMAP.md`](DEMO_ROADMAP.md)

## Quick start (VS Code)

Needs **Node.js 20.12 or newer** (`node -v`) and Git.

1. **Clone & open:** `git clone https://github.com/BHUgraduate/DemoForm.git`, then *File → Open Folder…* (or `code DemoForm`).
2. **Terminal → New Terminal**, then:
   ```bash
   npm install
   npm run dev
   ```
3. Open **http://localhost:5173**. Sign in with the demo logins below. Submit a release as the artist; watch it appear in `/admin` as the admin (use a private window for the second user).
4. **Optional — Google Sheet control panel:** do [`GOOGLE_SHEETS_SETUP.md`](GOOGLE_SHEETS_SETUP.md), put the values in a `.env` file (copy `.env.example`; it is git-ignored), and **restart** `npm run dev`. The terminal prints `[GoogleSheets] Poller started`. Without it, everything works except the sheet.
5. No Google account handy? Use the emulator below to rehearse the exact flow locally.

## Run it

```bash
npm install
cp .env.example .env     # optional; Google Sheets stays off until configured
npm run dev              # UI http://localhost:5173, API http://localhost:3001
# or single process:  npm run build && npm start   → http://localhost:3001
```

Demo logins (shown on the sign-in page; set `SHOW_DEMO_LOGINS=false` to hide): `artist@example.com` / `artist-demo-123`, `admin@example.com` / `admin-demo-123`.
Delete `data/` to reset. First start seeds 3 fictional sample releases (not synced to the sheet).

### Rehearse without Google (local emulator)
```bash
npx tsx scripts/fake-sheets.ts &                                   # fake Sheets API on :4010
GOOGLE_SHEETS_EMULATOR_URL=http://127.0.0.1:4010 GOOGLE_SHEETS_SPREADSHEET_ID=demo-sheet \
GOOGLE_SHEETS_POLL_INTERVAL_MS=5000 npm start
curl -XPOST localhost:4010/__control/set -H 'content-type: application/json' \
     -d '{"id":"REL-2026-00004","column":"O","value":"Approved"}'   # "edit the sheet"
curl localhost:4010/__control/dump                                   # "look at the sheet"
```
With real Google, follow [`GOOGLE_SHEETS_SETUP.md`](GOOGLE_SHEETS_SETUP.md).

## Demo script
1. Sign in as the artist → **Distribute Your Music** → 8 steps (samples in `demo-assets/`) → **Submit**. Confirmation shows the ID and **Under Review**.
2. Sign in as admin (second browser/profile) → `/admin`: the release is there; **Open Google Sheet** opens the sheet; the **Sheet** column shows ● synced.
3. In the Google Sheet change **Status** → *Approved* (try **Needs Changes** + an **Admin Note**).
4. Wait one poll interval (`GOOGLE_SHEETS_POLL_INTERVAL_MS`; use `10000` live). The server log shows `status changed: Under Review → Approved`.
5. The artist's **My Releases** page flips to **✓ Approved** by itself (refreshes every 10 s) and shows the admin message.
6. Reverse direction: change status in `/admin` → the sheet cell updates; no loop.

## Routes
| UI | |
|---|---|
| `/` · `/login` | landing · sign in / register |
| `/distribute` · `/submitted/:id` | release wizard · confirmation *(artist)* |
| `/dashboard` | **My Releases** with live status + admin message *(artist)* |
| `/admin` · `/admin/releases/:id` | dashboard, filters, exports, **Open Google Sheet**, **Sync now**, status + note editor *(admin)* |

| API | |
|---|---|
| `POST /api/auth/register · login · logout`, `GET /api/auth/me` | session cookie (HttpOnly, signed) |
| `POST /api/uploads/audio · artwork` | multipart, content-verified *(artist)* |
| `POST /api/releases` | validate → store (owner = session user, status **Under Review**) → mirror to sheet → `{success, submissionId, status}` |
| `GET /api/my/releases[/:id]` | the signed-in artist's releases (what the dashboard polls) |
| `GET /api/admin/releases[/:id] · stats` | admin data (`?search&status&releaseType&genre&sort`) |
| `PATCH /api/admin/releases/:id/status` | `{status, adminNote?}` → DB → sheet |
| `GET /api/admin/sheets` · `POST /api/admin/sheets/sync` | sync health · run a sync now |
| `GET /api/admin/export.xlsx · export.csv` | file exports |

Statuses: **Under Review** (initial) · **Approved** · **Rejected** · **Needs Changes** · **Processing** · **Completed**.

## Layout
```
shared/schema.ts           zod schemas + types (client and server)
server/sheets/             columns.ts (layout) · gateway.ts (Google client) · sync.ts (reconcile + poller)
server/auth/, routes/      sessions, scrypt passwords, guards, API routes
server/storage/            ReleaseRepository / UserRepository (JSON files) · FileStorage (local disk)
src/                       React UI: pages/ (Login, Dashboard, Distribute, admin/…), components/, lib/
tests/                     api.test.ts · sheets.test.ts (round trip) · helpers/fakeSheets.ts (Sheets API emulator)
scripts/                   e2e-sheets.cjs (browser round trip) · fake-sheets.ts · make-demo-assets.mjs
```

## Tests
```bash
npm test             # 14 API + round-trip tests (real Google client ↔ local emulator)
npm run typecheck
NODE_PATH=$(npm root -g) node scripts/e2e-sheets.cjs   # Playwright; needs fake-sheets + app running (see header of the script)
```

## Demo-only / not production
JSON-file database and local-disk uploads; demo-grade accounts (no email verification, MFA, password reset); polling instead of push; no DSP delivery, payments, royalties, ISRC/UPC issuing or rights checks. See the architecture doc for the production hardening list.
