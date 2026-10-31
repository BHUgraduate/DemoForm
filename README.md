# Soundlane — music release submission demo

> **This is a client demonstration, not a distributor.** It proves one workflow end to end:
> **artist form → real API → persisted record → admin view → Excel export.**
> See [`DEMO_ROADMAP.md`](DEMO_ROADMAP.md) for what a commercial platform would still need.

## Run it

```bash
npm install
npm run dev          # UI on http://localhost:5173, API on http://localhost:3001
```

Single-process production mode (what to use on a presentation laptop):

```bash
npm run build && npm start     # everything on http://localhost:3001
```

First start inserts 3 fictional sample submissions (flagged `isDemoData`, shown with a "sample" tag). Set `DEMO_SEED=false` to skip. Delete the `data/` folder to reset. Copy `.env.example` to `.env` to change port / data dir / upload limits.

Tests: `npm test` (API integration, incl. reading the generated `.xlsx` back) · `npm run typecheck`.
Browser walkthrough: `NODE_PATH=$(npm root -g) node scripts/e2e-demo.cjs` (needs the server running; uses Playwright).

## 2–5 minute demo script

1. Open `/` → **Distribute Your Music**.
2. Walk the 8 steps. Use `demo-assets/sample-track.wav` and `demo-assets/sample-cover.png` for the uploads (try a `.pdf` first to show the rejection).
3. **Submit Release** → confirmation shows the generated ID (e.g. `REL-2026-00004`).
4. **View Submission** (or open `/admin`) → the new row is at the top; click it to see every captured field, the stored cover, and an audio player.
5. Change the status (Under Review / Approved…), try search + filters.
6. **Export to Excel** → open the `.xlsx`; the new submission is a row with all columns.

## Routes

| Frontend | |
|---|---|
| `/` | Artist landing page |
| `/distribute` | 8-step submission wizard (autosaves a draft in the browser) |
| `/submitted/:id` | Confirmation (reads the receipt back from the API) |
| `/admin` | **DEMO** dashboard: stat cards, search, filters, sort, exports |
| `/admin/releases/:id` | Submission detail + status change |

| API | |
|---|---|
| `POST /api/uploads/audio` · `/api/uploads/artwork` | multipart upload; type verified by file *contents*; returns file id + metadata |
| `POST /api/releases` | validates, sanitises, generates `REL-YYYY-NNNNN`, stores → `201 {success, submissionId, message}` (`400` field errors, `409` duplicate) |
| `GET /api/releases/:id` | minimal public receipt |
| `GET /api/admin/stats` · `/releases` · `/releases/:id` | dashboard data (`?search&status&releaseType&genre&sort`) |
| `PATCH /api/admin/releases/:id/status` | Submitted · Under Review · Approved · Rejected |
| `GET /api/admin/releases/:id/files/audio\|artwork` | serves stored upload |
| `GET /api/admin/export.xlsx` · `export.csv` | exports (respect current filters) |

## Architecture

```
shared/schema.ts            zod schemas + types — used by BOTH client and server
server/
  app.ts, index.ts          Express app + bootstrap
  routes/public.ts          uploads + POST /api/releases
  routes/admin.ts           admin API + exports
  storage/releaseRepository.ts   ReleaseRepository interface + JSON-file implementation
  storage/fileStorage.ts         FileStorage interface + local-disk implementation
  storage/fileSniff.ts           magic-byte checks, image dimensions
  export/columns.ts, xlsx.ts     the 44 export columns; exceljs workbook; CSV
  seed.ts                   fictional demo rows
src/                        React + Vite UI (pages/, components/steps/, lib/)
```

**Storage (demo):** `data/releases.json` (atomic write-then-rename, serialised writes) and `data/uploads/<uuid>.bin|json`. Client filenames never touch filesystem paths. To go to production, implement `ReleaseRepository` (Postgres/Supabase/Firestore) and `FileStorage` (S3/GCS) — no route changes needed.

**Excel export:** `exceljs` builds a real `.xlsx` server-side: frozen header row + first column, styled header, autofilter, set column widths, true date cells (`yyyy-mm-dd hh:mm`), numeric track count / MB, multi-value fields comma-joined. Filename `music-distribution-submissions-YYYY-MM-DD.xlsx`. CSV export neutralises formula-looking text.

## Intentionally mocked / demo-only

- **No authentication** anywhere; `/admin` is clearly labelled DEMO and is not secure.
- Store selection is saved but nothing is delivered to any store. No payments, royalties, ISRC/UPC issuing, rights verification or identity checks.
- JSON file + local disk instead of a database and object storage; no virus scanning, rate limiting or CSRF protection.
- One audio file per release (track metadata supports many tracks).
- Seeded rows have metadata only — no audio/artwork bytes.
- Browser `localStorage` is used **only** for the in-progress draft; submissions always go to the API.
