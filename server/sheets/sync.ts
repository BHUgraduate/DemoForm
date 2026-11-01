import { STATUSES, type ReleaseRecord, type Status } from '../../shared/schema.ts';
import type { ReleaseRepository } from '../storage/releaseRepository.ts';
import { COL, releaseToRow } from './columns.ts';
import type { SheetRow, SheetsGateway } from './gateway.ts';

export type Logger = (message: string) => void;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e)).slice(0, 300);

/** Case-insensitive, whitespace-tolerant match against the allowed list. The cell TEXT is the source of truth. */
export function normalizeStatus(raw: string | undefined): Status | null {
  const v = (raw ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
  return STATUSES.find((s) => s.toLowerCase() === v) ?? null;
}

interface Pair { status: Status | null; note: string }
const same = (a: Pair, b: Pair) => a.status === b.status && a.note === b.note;

export interface SyncState {
  enabled: boolean;
  lastPollAt: string | null;
  lastPollOk: boolean | null;
  lastError: string | null;
  lastSummary: { rows: number; changedFromSheet: number; pushedToSheet: number; created: number } | null;
}

/**
 * Two-way Status/Admin-Note synchronisation between the database and ONE Google Sheet.
 *
 * Key: Submission ID (never name/email/row number). For every release we remember the last (status, note) pair that was
 * identical on both sides ("last synced"). Comparing DB, Sheet and last-synced tells us WHO changed:
 *
 *   DB == Sheet            → nothing to do (idempotent; no writes at all)
 *   DB == last-synced      → the SHEET changed       → copy Sheet → DB
 *   Sheet == last-synced   → the DB changed          → copy DB → Sheet
 *   all three differ       → both changed (conflict) → the Sheet wins (it is the control panel)
 *
 * After any copy, last-synced is set to the copied value, so the next poll sees DB == Sheet and stops: no loops.
 * All sheet operations run one at a time (single-flight) so a poll can never read half of an append.
 */
export class SheetsSync {
  state: SyncState;
  private chain: Promise<unknown> = Promise.resolve();
  private ready = false;

  constructor(
    private repo: ReleaseRepository,
    private gw: SheetsGateway | null,
    private log: Logger = (m) => console.log(m),
    private now: () => string = () => new Date().toISOString(),
  ) {
    this.state = { enabled: !!gw, lastPollAt: null, lastPollOk: null, lastError: null, lastSummary: null };
  }

  get enabled() { return !!this.gw; }

  private serial<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.chain.then(fn, fn);
    this.chain = run.catch(() => undefined);
    return run;
  }

  /** Background poll (and manual "Sync now"). Never throws. */
  async poll(reason: 'poll' | 'manual' | 'push' = 'poll'): Promise<void> {
    if (!this.gw) return;
    await this.serial(() => this.cycle(reason)).catch(() => undefined);
  }

  /**
   * Called right after a submission or an admin-dashboard edit so the sheet updates immediately.
   * Resolves when synced OR after `timeoutMs` (the work continues in the background; the poller retries on failure).
   */
  async push(timeoutMs = 6000): Promise<void> {
    if (!this.gw) return;
    await Promise.race([this.poll('push'), sleep(timeoutMs)]);
  }

  private async cycle(reason: string) {
    const gw = this.gw!;
    const started = this.now();
    this.log(reason === 'poll' ? '[GoogleSheets] Poll started' : `[GoogleSheets] Sync started (${reason})`);
    const summary = { rows: 0, changedFromSheet: 0, pushedToSheet: 0, created: 0 };
    try {
      if (!this.ready) { await gw.ensureReady(); this.ready = true; this.log('[GoogleSheets] Worksheet ready (header, dropdown, formatting verified)'); }
      this.log('[GoogleSheets] Reading sheet');
      const rows = await gw.readRows();
      const byId = new Map<string, SheetRow>();
      for (const r of rows) {
        const id = (r.cells[COL.submissionId] ?? '').trim();
        if (byId.has(id)) this.log(`[GoogleSheets] WARNING duplicate Submission ID ${id} in rows ${byId.get(id)!.row} and ${r.row}; using the first`);
        else byId.set(id, r);
      }
      this.log(`[GoogleSheets] Found ${byId.size} submissions in sheet`);
      summary.rows = byId.size;

      const records = (await this.repo.list({ sort: 'asc' })).filter((r) => !r.isDemoData);
      const known = new Set(records.map((r) => r.id));
      for (const id of byId.keys()) if (!known.has(id)) this.log(`[GoogleSheets] ${id} is in the sheet but not in the database — ignored`);

      for (const rec of records) {
        try {
          const entry = byId.get(rec.id);
          if (!entry) await this.create(rec, summary);
          else await this.reconcile(rec, entry, summary);
        } catch (e) {
          this.log(`[GoogleSheets] ERROR ${rec.id}: ${errMsg(e)}`);
          await this.repo.update(rec.id, (r) => ({ ...r, googleSheetSyncStatus: 'failed', googleSheetLastError: errMsg(e) }));
        }
      }
      this.state = { enabled: true, lastPollAt: started, lastPollOk: true, lastError: null, lastSummary: summary };
      this.log('[GoogleSheets] Poll completed');
    } catch (e) {
      // Whole-sheet failure (network, auth, quota…): never crash; mark anything awaiting sync as failed; retry next cycle.
      this.ready = false;
      this.log(`[GoogleSheets] ERROR poll failed: ${errMsg(e)} — will retry next cycle`);
      this.state = { ...this.state, enabled: true, lastPollAt: started, lastPollOk: false, lastError: errMsg(e) };
      for (const r of await this.repo.list()) {
        if (!r.isDemoData && r.googleSheetSyncStatus !== 'synced') await this.repo.update(r.id, (x) => ({ ...x, googleSheetSyncStatus: 'failed', googleSheetLastError: errMsg(e) }));
      }
    }
  }

  /** The release has no row in the sheet (new, or the admin deleted it): append one. */
  private async create(rec: ReleaseRecord, summary: { created: number }) {
    const row = await this.gw!.appendRow(releaseToRow(rec));
    await this.markSynced(rec.id, row, rec.status, rec.adminNote);
    summary.created++;
    this.log(rec.googleSheetRow ? `[GoogleSheets] ${rec.id} row was missing; re-created at row ${row}` : `[GoogleSheets] ${rec.id} appended at row ${row}`);
  }

  private async reconcile(rec: ReleaseRecord, entry: SheetRow, summary: { changedFromSheet: number; pushedToSheet: number }) {
    const sheetStatus = normalizeStatus(entry.cells[COL.status]);
    const sheet: Pair = { status: sheetStatus, note: (entry.cells[COL.adminNote] ?? '').trim() };
    const db: Pair = { status: rec.status, note: rec.adminNote };
    const last: Pair = { status: rec.googleSheetLastSyncedStatus, note: rec.googleSheetLastSyncedNote ?? '' };

    if (sheetStatus === null) {
      // Blank / not an allowed value: never apply it. Repair the cell from the database.
      this.log(`[GoogleSheets] ${rec.id} has invalid status "${entry.cells[COL.status] ?? ''}" in the sheet — restoring "${rec.status}"`);
      return this.pushToSheet(rec, entry, summary);
    }
    if (same(db, sheet)) {
      if (!same(last, sheet) || rec.googleSheetRow !== entry.row || rec.googleSheetSyncStatus !== 'synced') {
        await this.markSynced(rec.id, entry.row, sheet.status!, sheet.note); // bookkeeping only
      }
      this.log(`[GoogleSheets] ${rec.id} unchanged`);
      return;
    }
    if (same(db, last)) return this.applyFromSheet(rec, entry, sheet, summary, false);
    if (same(sheet, last)) return this.pushToSheet(rec, entry, summary);
    return this.applyFromSheet(rec, entry, sheet, summary, true);
  }

  private async applyFromSheet(rec: ReleaseRecord, entry: SheetRow, sheet: Pair, summary: { changedFromSheet: number }, conflict: boolean) {
    const updated = await this.repo.update(rec.id, (r) =>
      // Only apply if nobody changed the record since we read it (otherwise the next cycle sorts it out).
      r.status === rec.status && r.adminNote === rec.adminNote
        ? { ...r, status: sheet.status!, adminNote: sheet.note, updatedAt: this.now(), googleSheetRow: entry.row, googleSheetLastSyncedStatus: sheet.status!, googleSheetLastSyncedNote: sheet.note, googleSheetSyncStatus: 'synced', googleSheetLastError: undefined }
        : null);
    if (!updated || updated.status !== sheet.status || updated.adminNote !== sheet.note) return;
    summary.changedFromSheet++;
    if (conflict) this.log(`[GoogleSheets] ${rec.id} changed in BOTH places — sheet wins`);
    if (rec.status !== sheet.status) this.log(`[GoogleSheets] ${rec.id} status changed: ${rec.status} → ${sheet.status}`);
    if (rec.adminNote !== sheet.note) this.log(`[GoogleSheets] ${rec.id} admin note updated${sheet.note ? `: "${sheet.note}"` : ' (cleared)'}`);
    this.log('[GoogleSheets] Database updated');
  }

  private async pushToSheet(rec: ReleaseRecord, entry: SheetRow, summary: { pushedToSheet: number }) {
    const row = await this.gw!.writeStatus(rec.id, entry.row, rec.status, rec.adminNote, rec.updatedAt);
    if (row === null) throw new Error('row disappeared while writing; will be re-created next cycle');
    await this.markSynced(rec.id, row, rec.status, rec.adminNote);
    summary.pushedToSheet++;
    this.log(`[GoogleSheets] ${rec.id} pushed to sheet: ${rec.status}${rec.adminNote ? ` (note: "${rec.adminNote}")` : ''}`);
  }

  /** Records that (status, note) is now identical on both sides — unless the DB moved on in the meantime. */
  private async markSynced(id: string, row: number, status: Status, note: string) {
    await this.repo.update(id, (r) => ({
      ...r,
      googleSheetRow: row,
      googleSheetLastSyncedStatus: status,
      googleSheetLastSyncedNote: note,
      googleSheetLastError: undefined,
      googleSheetSyncStatus: r.status === status && r.adminNote === note ? 'synced' : 'pending',
    }));
  }
}

/** Runs poll() every `intervalMs`, waiting for each run to finish first (cycles never overlap). */
export function startPoller(sync: SheetsSync, intervalMs: number, log: Logger = (m) => console.log(m)): () => void {
  if (!sync.enabled) { log('[GoogleSheets] Sync disabled (no spreadsheet credentials configured) — database only'); return () => {}; }
  log(`[GoogleSheets] Poller started, interval ${intervalMs} ms`);
  let stopped = false;
  let timer: NodeJS.Timeout | undefined;
  const tick = async () => {
    await sync.poll('poll');
    if (!stopped) timer = setTimeout(tick, intervalMs);
  };
  void tick();
  return () => { stopped = true; if (timer) clearTimeout(timer); };
}
