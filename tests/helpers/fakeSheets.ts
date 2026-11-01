/**
 * A small emulator of the Google Sheets v4 REST endpoints the app uses
 * (spreadsheets.get / batchUpdate, values.get / append / update / batchUpdate).
 * The REAL @googleapis/sheets client is pointed at it, so request building and response parsing are genuinely exercised.
 * It is NOT Google: quotas, auth, eventual consistency etc. are not modelled.
 *
 * Also exposes "admin hands" for tests/demos: setCell(), insertRow(), deleteRow(), failing.
 */
import http from 'node:http';
import type { AddressInfo } from 'node:net';

type Grid = string[][];
interface Tab { sheetId: number; title: string; grid: Grid; conditionalFormats: number; validations: unknown[]; frozen: number }

const colIndex = (letters: string) => letters.split('').reduce((n, c) => n * 26 + c.charCodeAt(0) - 64, 0) - 1;

export function parseA1(range: string) {
  const m = /^(?:'((?:[^']|'')+)'|([^!']+))!(\$?[A-Z]+)(\d+)?(?::(\$?[A-Z]+)(\d+)?)?$/.exec(range);
  if (!m) throw new Error(`bad range ${range}`);
  const tab = (m[1] ?? m[2]).replace(/''/g, "'");
  const c1 = colIndex(m[3].replace('$', ''));
  const r1 = m[4] ? Number(m[4]) - 1 : 0;
  const c2 = m[5] ? colIndex(m[5].replace('$', '')) : c1;
  const r2 = m[6] ? Number(m[6]) - 1 : m[5] ? null : r1; // "A2:R" → open-ended; "A5" → single row
  return { tab, c1, r1, c2, r2 };
}

export class FakeSheets {
  tabs = new Map<string, Tab>();
  failing = false;
  /** Every API call received: "GET values", "POST append", … */
  calls: string[] = [];
  private server!: http.Server;
  private nextSheetId = 100;
  url = '';

  constructor(public spreadsheetId = 'test-spreadsheet') {}

  async start(port = 0) {
    this.server = http.createServer((req, res) => void this.handle(req, res));
    await new Promise<void>((r) => this.server.listen(port, '127.0.0.1', r));
    this.url = `http://127.0.0.1:${(this.server.address() as AddressInfo).port}/`;
    return this;
  }
  stop() { return new Promise<void>((r) => this.server.close(() => r())); }

  /* ── "the admin's hands" ── */
  tab(title = 'Releases') { const t = this.tabs.get(title); if (!t) throw new Error(`no tab ${title}`); return t; }
  cell(row: number, col: string, title = 'Releases') { return this.tab(title).grid[row - 1]?.[colIndex(col)] ?? ''; }
  setCell(row: number, col: string, value: string, title = 'Releases') { this.write(this.tab(title), row - 1, colIndex(col), value); }
  insertRow(atRow: number, values: string[], title = 'Releases') { this.tab(title).grid.splice(atRow - 1, 0, values); }
  deleteRow(row: number, title = 'Releases') { this.tab(title).grid.splice(row - 1, 1); }
  /** Finds the row of a Submission ID (column A). */
  rowOf(id: string, title = 'Releases') { const i = this.tab(title).grid.findIndex((r, n) => n > 0 && r[0] === id); return i < 0 ? null : i + 1; }
  dataRows(title = 'Releases') { return this.tab(title).grid.slice(1).filter((r) => r.some((c) => c !== '')); }

  private write(t: Tab, r: number, c: number, v: string) {
    while (t.grid.length <= r) t.grid.push([]);
    const row = t.grid[r];
    while (row.length <= c) row.push('');
    row[c] = v;
  }
  private lastUsedRow(t: Tab) { for (let i = t.grid.length - 1; i >= 0; i--) if (t.grid[i].some((c) => c !== '')) return i; return -1; }
  private addTab(title: string) {
    const t: Tab = { sheetId: this.nextSheetId++, title, grid: [], conditionalFormats: 0, validations: [], frozen: 0 };
    this.tabs.set(title, t);
    return t;
  }

  private async handle(req: http.IncomingMessage, res: http.ServerResponse) {
    const send = (status: number, body: unknown) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(body)); };
    try {
      const chunks: Buffer[] = [];
      for await (const c of req) chunks.push(c as Buffer);
      const raw = Buffer.concat(chunks).toString();
      const body = raw ? JSON.parse(raw) : {};
      const url = new URL(req.url!, 'http://x');
      const path = decodeURIComponent(url.pathname);
      const method = req.method!;

      // demo control surface (works even while "failing")
      if (path === '/__control/dump') return send(200, { tabs: [...this.tabs.values()].map((t) => ({ title: t.title, rows: t.grid })) });
      if (path === '/__control/set' && method === 'POST') {
        const row = body.row ?? this.rowOf(body.id);
        if (!row) return send(404, { error: 'row not found' });
        this.setCell(row, body.column, body.value);
        return send(200, { ok: true, row });
      }
      if (path === '/__control/fail' && method === 'POST') { this.failing = !!body.on; return send(200, { failing: this.failing }); }

      if (this.failing) { this.calls.push('FAILED'); return send(503, { error: { code: 503, message: 'Service unavailable (simulated outage)', status: 'UNAVAILABLE' } }); }

      const base = `/v4/spreadsheets/${this.spreadsheetId}`;
      if (!path.startsWith(base)) return send(404, { error: { code: 404, message: 'Requested entity was not found.', status: 'NOT_FOUND' } });
      const rest = path.slice(base.length);

      if (rest === '' && method === 'GET') {
        this.calls.push('GET spreadsheet');
        return send(200, { spreadsheetId: this.spreadsheetId, sheets: [...this.tabs.values()].map((t) => ({
          properties: { sheetId: t.sheetId, title: t.title }, conditionalFormats: Array.from({ length: t.conditionalFormats }, () => ({})),
        })) });
      }
      if (rest === ':batchUpdate' && method === 'POST') {
        this.calls.push('POST batchUpdate');
        const replies = [];
        for (const r of body.requests ?? []) {
          if (r.addSheet) { const t = this.addTab(r.addSheet.properties.title); replies.push({ addSheet: { properties: { sheetId: t.sheetId, title: t.title } } }); continue; }
          const t = [...this.tabs.values()].find((x) => x.sheetId === (r.setDataValidation ?? r.addConditionalFormatRule?.rule?.ranges?.[0] ?? r.updateSheetProperties?.properties ?? r.repeatCell)?.sheetId
            || x.sheetId === r.setDataValidation?.range?.sheetId || x.sheetId === r.addConditionalFormatRule?.rule?.ranges?.[0]?.sheetId || x.sheetId === r.updateSheetProperties?.properties?.sheetId || x.sheetId === r.repeatCell?.range?.sheetId);
          if (r.addConditionalFormatRule && t) t.conditionalFormats++;
          if (r.setDataValidation && t) t.validations.push(r.setDataValidation.rule);
          if (r.updateSheetProperties && t) t.frozen = r.updateSheetProperties.properties.gridProperties.frozenRowCount;
          replies.push({});
        }
        return send(200, { spreadsheetId: this.spreadsheetId, replies });
      }

      if (rest === '/values:batchUpdate' && method === 'POST') {
        this.calls.push('POST values:batchUpdate');
        for (const d of body.data ?? []) this.putValues(d.range, d.values);
        return send(200, { totalUpdatedCells: (body.data ?? []).length });
      }
      const m = /^\/values\/(.+?)(:append)?$/.exec(rest);
      if (m) {
        const range = m[1];
        if (m[2] && method === 'POST') {
          this.calls.push('POST append');
          const { tab, c1 } = parseA1(range);
          const t = this.tabs.get(tab);
          if (!t) return send(400, { error: { code: 400, message: `Unable to parse range: ${range}`, status: 'INVALID_ARGUMENT' } });
          const row = this.lastUsedRow(t) + 1;
          const vals: string[][] = body.values ?? [];
          vals.forEach((v, i) => v.forEach((cell, j) => this.write(t, row + i, c1 + j, String(cell))));
          const last = c1 + (vals[0]?.length ?? 1) - 1;
          const L = (i: number) => String.fromCharCode(65 + i);
          return send(200, { updates: { updatedRange: `'${tab}'!${L(c1)}${row + 1}:${L(last)}${row + vals.length}`, updatedRows: vals.length } });
        }
        if (method === 'GET') {
          this.calls.push('GET values');
          const { tab, c1, r1, c2, r2 } = parseA1(range);
          const t = this.tabs.get(tab);
          if (!t) return send(400, { error: { code: 400, message: `Unable to parse range: ${range}`, status: 'INVALID_ARGUMENT' } });
          const end = r2 === null ? t.grid.length - 1 : r2;
          const rows: string[][] = [];
          for (let r = r1; r <= end && r < t.grid.length; r++) {
            const cells = (t.grid[r] ?? []).slice(c1, c2 + 1);
            while (cells.length && cells[cells.length - 1] === '') cells.pop(); // Google trims trailing empties
            rows.push(cells);
          }
          while (rows.length && rows[rows.length - 1].length === 0) rows.pop();
          return send(200, rows.length ? { range, majorDimension: 'ROWS', values: rows } : { range, majorDimension: 'ROWS' });
        }
        if (method === 'PUT') {
          this.calls.push('PUT values');
          this.putValues(range, body.values);
          return send(200, { updatedCells: 1 });
        }
      }
      return send(404, { error: { code: 404, message: `unhandled ${method} ${rest}`, status: 'NOT_FOUND' } });
    } catch (e) {
      return send(500, { error: { code: 500, message: String(e) } });
    }
  }

  private putValues(range: string, values: string[][]) {
    const { tab, c1, r1 } = parseA1(range);
    const t = this.tabs.get(tab);
    if (!t) throw new Error(`no tab ${tab}`);
    (values ?? []).forEach((row, i) => row.forEach((cell, j) => this.write(t, r1 + i, c1 + j, String(cell))));
  }
}
