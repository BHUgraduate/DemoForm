# Google Sheets setup

The app reads and writes **one private Google Sheet** from the **backend only**, using a Google Cloud *service account*. Nothing Google-related ever reaches the browser.

> **Verification status:** the integration uses Google's official `@googleapis/sheets` client and is covered by automated tests and a browser round trip against a local *emulator* of the Sheets API (`npm test`, `scripts/e2e-sheets.cjs`). It has **not** been run against live Google in the environment where it was built (no Google credentials were available). Do the 10-minute check at the end of this page with your real sheet before the client demo.

## 1. Create or select a Google Cloud project
<https://console.cloud.google.com/> → project picker → **New project** (e.g. `soundlane-demo`).

## 2. Enable the Google Sheets API
**APIs & Services → Library →** search *Google Sheets API* → **Enable**.

## 3. Create a service account
**IAM & Admin → Service Accounts → Create service account** (e.g. `sheets-sync`). No project roles are needed — access is granted by sharing the sheet (step 7). Copy its email: `sheets-sync@<project>.iam.gserviceaccount.com`.

## 4. Generate credentials
Open the service account → **Keys → Add key → Create new key → JSON**. A `.json` file downloads. It contains:

* `client_email` → `GOOGLE_SHEETS_SERVICE_ACCOUNT_EMAIL`
* `private_key`  → `GOOGLE_SHEETS_PRIVATE_KEY`

> Treat this file like a password. **Never commit it** (`.gitignore` blocks `service-account*.json` and `.env`), never paste it into chat or tickets, and delete the key in the console when the demo is over.
> If *Create key* is greyed out, your organisation enforces `iam.disableServiceAccountKeyCreation`; ask an org admin for an exception or use a personal project.

## 5. Configure the backend
Copy `.env.example` to `.env` and fill in:

```ini
GOOGLE_SHEETS_SPREADSHEET_ID=<from step 6>
GOOGLE_SHEETS_WORKSHEET_NAME=Releases
GOOGLE_SHEETS_SERVICE_ACCOUNT_EMAIL=sheets-sync@your-project.iam.gserviceaccount.com
GOOGLE_SHEETS_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIE...\n-----END PRIVATE KEY-----\n"
GOOGLE_SHEETS_POLL_INTERVAL_MS=60000
```
The key must be on **one line**, in double quotes, with the literal two characters `\n` where the JSON has them (copy the `private_key` string value as-is). On hosts with a secrets UI (Render, Railway, Fly…) set these as environment variables instead of a file.

## 6. Create the Google Sheet
<https://sheets.google.com> → **Blank spreadsheet**. Name it e.g. *Soundlane — Release Control Panel*.
The **Spreadsheet ID** is the long token in the URL: `https://docs.google.com/spreadsheets/d/`**`THIS_PART`**`/edit`.

You do **not** need to create the `Releases` tab or headers — on startup the backend creates the tab if missing, writes the header row, freezes it, adds a **Status dropdown** and colour-codes the statuses.

## 7. Share the sheet with the service account
**Share →** paste the service-account email → role **Editor** → untick *Notify* → **Share**.
Then share the sheet with your admin(s) (Editor). Keep general access **Restricted**; do not use "anyone with the link".

## 8. Start the backend
```bash
npm install && npm run build && npm start
```
(Use `GOOGLE_SHEETS_POLL_INTERVAL_MS=10000` while presenting, back to `60000` afterwards.)

## 9. Verify (do this before the demo)
1. Startup log shows `[GoogleSheets] Poller started…` then `Worksheet ready`. Open the sheet: a `Releases` tab with headers appeared.
2. Sign in as `artist@example.com` (demo password on the sign-in page), submit a release. Within seconds the sheet gets a row with **Status = Under Review**, and `/admin` shows the **Sheet: ● synced** badge.
3. In the sheet, change **Status** to *Approved* (and optionally type an **Admin Note**). Within one poll interval the log prints `REL-… status changed: Under Review → Approved` and `Database updated`.
4. The artist's **My Releases** page shows **✓ Approved** (it refreshes itself every 10 s — no reload).

## Sheet structure
Sheet name `Releases` (configurable). Defined in one place: `server/sheets/columns.ts`.

| Col | Header | Notes |
|---|---|---|
| A | Submission ID | **sync key** — don't edit |
| B | User ID | |
| C | Artist Name | |
| D | Artist Email | |
| E | Phone | |
| F | Release Title | |
| G | Release Type | |
| H | Genre | |
| I | Language | |
| J | Release Date | |
| K | Track Count | |
| L | Distribution Platforms | |
| M | Audio File | filename |
| N | Cover Artwork | filename |
| **O** | **Status** | **admin edits** — dropdown: Under Review · Approved · Rejected · Needs Changes · Processing · Completed |
| **P** | **Admin Note** | **admin edits** — shown to the artist |
| Q | Created At | |
| R | Updated At | written by the server |

Only **Status** and **Admin Note** are read back. Editing other columns changes nothing in the app. You may sort, filter, hide columns or insert rows freely — rows are matched by **Submission ID**, never by position.

## Troubleshooting
| Log / symptom | Cause |
|---|---|
| `The caller does not have permission` (403) | Sheet not shared with the service-account email as Editor |
| `Requested entity was not found` (404) | Wrong `GOOGLE_SHEETS_SPREADSHEET_ID` |
| `Google Sheets API has not been used in project … or it is disabled` | Step 2 not done (wait ~1 min after enabling) |
| `error:1E08010C:DECODER routines::unsupported` / `invalid_grant` / `No key or keyFile set` | Private key mangled: needs quotes and literal `\n`; or wrong service-account email |
| Admin page says *Google Sheet control panel: not configured* | Spreadsheet ID, email or key is empty |
| Status typed in sheet is ignored | Not one of the six allowed values (the cell is restored from the database and a warning is logged) |
| `429 Quota exceeded` | Google's per-minute read quota. An idle poll costs 1 read; 10 s polling = 6 reads/min, well inside limits |
