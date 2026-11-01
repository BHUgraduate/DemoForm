# Google Sheets control-panel architecture

```
                 ┌──────────────────┐
                 │   ARTIST USER    │
                 └────────┬─────────┘
                          │ signs in (session cookie)
                          ▼
                 ┌──────────────────┐   polls GET /api/my/releases every 10 s
                 │  USER DASHBOARD  │◄────────────────────────────────────────┐
                 └────────┬─────────┘                                         │
                          │ release form → POST /api/releases                 │
                          ▼                                                   │
                 ┌──────────────────┐                                         │
                 │   BACKEND API    │  (Express; the ONLY thing that talks    │
                 └────────┬─────────┘   to Google)                            │
                 ┌────────┴─────────┐                                         │
                 ▼                  ▼  append row / write Status+Note         │
          ┌──────────────┐   ┌────────────────┐                               │
          │   DATABASE   │   │ GOOGLE SHEETS  │  (private; shared only with   │
          │ (JSON store) │   │  "Releases"    │   the service account + admins)│
          └──────┬───────┘   └───────┬────────┘                               │
                 │                    │ admin edits Status / Admin Note        │
                 ▼                    ▼                                        │
          ┌──────────────┐    ┌────────────────┐   Sheet → DB when it changed  │
          │  ADMIN DASH  │    │ BACKEND POLLER │───────────────────────────────┘
          │ (same data)  │    │ every N ms     │──► DATABASE ──► user + admin dashboards
          └──────────────┘    └────────────────┘
```

## Components
| Piece | File | Role |
|---|---|---|
| Column map | `server/sheets/columns.ts` | The single definition of the sheet layout (`COL`, `STATUS_COLUMN`, `releaseToRow`…) |
| Gateway | `server/sheets/gateway.ts` | Thin wrapper over Google's official client: ensure tab/header/dropdown, append, read, write status. Service-account auth. |
| Sync engine | `server/sheets/sync.ts` | `SheetsSync` (the reconciliation algorithm) + `startPoller` |
| Routes | `server/routes/public.ts`, `admin.ts` | Submit, my releases, admin status change, sheet status / "Sync now" |
| Storage | `server/storage/releaseRepository.ts` | Atomic `update()`; the DB is the application's record |

## Data model (per release)
`id` (= **Submission ID**, e.g. `REL-2026-00001`), `userId`, `status`, `adminNote`, `createdAt`, `updatedAt`, plus sync bookkeeping: `googleSheetRow` (a cache), `googleSheetLastSyncedStatus`, `googleSheetLastSyncedNote`, `googleSheetSyncStatus` (`pending | synced | failed | disabled | skipped`), `googleSheetLastError`.

## Flows
**Submit.** Authenticated `POST /api/releases` → server-side validation → save to DB (`status = Under Review`, owned by the session user) → run one sync cycle (waits up to 6 s) which appends the row and stores its row number → respond with the ID. If Google is slow/down the response is still `201`; the release is `failed/pending` and the poller completes it later.

**Sheet → app (the critical path).** Admin edits Status/Admin Note in the sheet → within one poll interval the poller reads all rows, matches by Submission ID, sees the value differs from the DB *and* that the DB has not changed since the last sync → updates the DB (`status`, `adminNote`, `updatedAt`) → admin dashboard and the artist's dashboard show it on their next refresh.

**App → sheet.** Admin changes status in the website → DB updated → sync cycle writes Status, Admin Note and Updated At into that release's row.

## Synchronisation rules
For each release we compare three (status, note) pairs: **DB**, **Sheet**, and **last-synced** (the pair that was identical on both sides last time).

| Situation | Action |
|---|---|
| DB = Sheet | **Nothing** (no writes anywhere — idempotent). Bookkeeping only if needed. |
| DB = last-synced, Sheet differs | Sheet changed → **update DB** |
| Sheet = last-synced, DB differs | DB changed → **update Sheet** |
| All three differ | Both changed → **Sheet wins** (it is the control panel); logged |
| Sheet status blank / not an allowed value | Never applied; the cell is **restored from the DB**; logged |
| Row missing in sheet | Row **re-created** (once) |
| Sheet row with unknown ID | **Ignored** — the sheet can never create database records |

* **No duplicates:** the key is the Submission ID; creating a row first checks the freshly-read sheet; all sheet work is single-flight (a poll can never see a half-finished append).
* **No loops:** after any copy, last-synced is set to the copied value; the next poll sees DB = Sheet and stops. An admin-dashboard "Approved" is pushed to the sheet, then read back as already-equal.
* **Row moves:** sorting/inserting/deleting rows is safe — rows are located by ID; the stored row number is only a hint, verified before every write.
* **Text is truth:** colours/dropdown are cosmetic; the cell text (case/space-insensitive) is what counts.
* Cells are written as plain text (`RAW`), so artist-supplied text can't become a spreadsheet formula.

## Failure handling
* **Google down / auth / quota error:** the poll catches it, logs `[GoogleSheets] ERROR … will retry next cycle`, marks unsynced releases `failed` (visible in `/admin`), and the process keeps running. The next cycle retries everything automatically. Submissions and both dashboards keep working from the database.
* **Per-release error** (e.g. one write fails): that release is marked `failed` with the message; the others continue.
* **Process restart:** all state is in the DB; the first poll reconciles.
* Poll cycles never overlap (`setTimeout` after completion, not `setInterval`).
* Admin page shows connection state, last poll time, interval, row count, and a **Sync now** button.

## Security (demo level) and what production would need
Done: credentials only in backend env vars; no Google call from the browser; the sheet is never exposed through an API; sessions are HttpOnly signed cookies; passwords use scrypt; admin routes need the admin role; artists only see their own releases; login throttling; input validated/sanitised server-side.

For production: managed identity provider + MFA; secrets manager and key rotation (or Workload Identity instead of a JSON key); audit log of who changed a status (the sheet's version history shows the editor, the app currently records only the change); sheet access limited to named admins, with protected ranges so only Status/Admin Note are editable; a real database (Postgres) behind `ReleaseRepository` and a queue/webhook (Apps Script `onEdit` → backend) instead of polling for instant updates; rate-limit/lockout in a shared store; CSRF tokens; encryption/retention policy for the personal data in the sheet; monitoring/alerting on `failed` sync states.
