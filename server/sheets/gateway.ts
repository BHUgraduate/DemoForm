import { sheets as sheetsApi, type sheets_v4 } from '@googleapis/sheets';
import { JWT } from 'google-auth-library';
import { STATUSES } from '../../shared/schema.ts';
import {
  ADMIN_NOTE_COLUMN, COL, FIRST_COLUMN, HEADERS, LAST_COLUMN, STATUS_COLUMN, SUBMISSION_ID_COLUMN, UPDATED_AT_COLUMN,
} from './columns.ts';

export interface SheetRow { row: number; cells: string[] }

/** Everything the sync engine needs from a spreadsheet. The Google implementation is below; tests can substitute others. */
export interface SheetsGateway {
  ensureReady(): Promise<void>;
  /** Appends a row and returns its 1-based row number. */
  appendRow(values: string[]): Promise<number>;
  /** All data rows (row 2 onward) that have a Submission ID. */
  readRows(): Promise<SheetRow[]>;
  /** Writes Status / Admin Note / Updated At for the row currently holding `submissionId`. Returns false if the ID is gone. */
  writeStatus(submissionId: string, hintRow: number | null, status: string, note: string, updatedAt: string): Promise<number | null>;
}

export interface GatewayOptions {
  spreadsheetId: string;
  worksheetName: string;
  /** Service-account credentials (server-side only). */
  serviceEmail?: string;
  privateKey?: string;
  /** Dev/test only: send the SAME client code to a local emulator instead of Google. */
  emulatorUrl?: string;
}

const CALL = { timeout: 20_000, retry: false } as const; // our poll loop is the retry mechanism

const STATUS_COLORS: Record<string, { red: number; green: number; blue: number }> = {
  'Under Review': { red: 1, green: 0.95, blue: 0.8 },
  Approved: { red: 0.82, green: 0.94, blue: 0.85 },
  Rejected: { red: 0.98, green: 0.82, blue: 0.8 },
  'Needs Changes': { red: 1, green: 0.88, blue: 0.7 },
  Processing: { red: 0.82, green: 0.89, blue: 0.98 },
  Completed: { red: 0.78, green: 0.9, blue: 0.9 },
};

export class GoogleSheetsGateway implements SheetsGateway {
  private api: sheets_v4.Sheets;
  private id: string;
  private tab: string;
  private q: string; // quoted tab name for A1 ranges

  constructor(o: GatewayOptions) {
    this.id = o.spreadsheetId;
    this.tab = o.worksheetName;
    this.q = `'${o.worksheetName.replace(/'/g, "''")}'`;
    if (o.emulatorUrl) {
      this.api = sheetsApi({ version: 'v4', rootUrl: o.emulatorUrl.replace(/\/?$/, '/') });
    } else {
      const auth = new JWT({ email: o.serviceEmail, key: o.privateKey, scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
      this.api = sheetsApi({ version: 'v4', auth });
    }
  }

  async ensureReady() {
    const meta = await this.api.spreadsheets.get({ spreadsheetId: this.id, fields: 'sheets(properties(sheetId,title),conditionalFormats)' }, CALL);
    let sheet = meta.data.sheets?.find((s) => s.properties?.title === this.tab);
    let created = false;
    if (!sheet) {
      const res = await this.api.spreadsheets.batchUpdate({ spreadsheetId: this.id, requestBody: { requests: [{ addSheet: { properties: { title: this.tab } } }] } }, CALL);
      sheet = { properties: res.data.replies?.[0]?.addSheet?.properties ?? undefined, conditionalFormats: [] };
      created = true;
    }
    const sheetId = sheet.properties?.sheetId ?? 0;

    const head = await this.api.spreadsheets.values.get({ spreadsheetId: this.id, range: `${this.q}!${FIRST_COLUMN}1:${LAST_COLUMN}1` }, CALL);
    const current = head.data.values?.[0] ?? [];
    if (HEADERS.some((h, i) => current[i] !== h)) {
      await this.api.spreadsheets.values.update({ spreadsheetId: this.id, range: `${this.q}!${FIRST_COLUMN}1:${LAST_COLUMN}1`, valueInputOption: 'RAW', requestBody: { values: [HEADERS] } }, CALL);
    }

    // One-time presentation: frozen bold header, Status dropdown, colour-coded statuses.
    if (created || !sheet.conditionalFormats?.length) {
      const statusRange = { sheetId, startRowIndex: 1, startColumnIndex: COL.status, endColumnIndex: COL.status + 1 };
      await this.api.spreadsheets.batchUpdate({
        spreadsheetId: this.id,
        requestBody: {
          requests: [
            { updateSheetProperties: { properties: { sheetId, gridProperties: { frozenRowCount: 1 } }, fields: 'gridProperties.frozenRowCount' } },
            { repeatCell: { range: { sheetId, startRowIndex: 0, endRowIndex: 1 }, cell: { userEnteredFormat: { textFormat: { bold: true } , backgroundColor: { red: 0.9, green: 0.9, blue: 0.9 } } }, fields: 'userEnteredFormat(textFormat,backgroundColor)' } },
            { setDataValidation: { range: statusRange, rule: { condition: { type: 'ONE_OF_LIST', values: STATUSES.map((s) => ({ userEnteredValue: s })) }, showCustomUi: true, strict: true } } },
            ...STATUSES.map((s, index) => ({
              addConditionalFormatRule: { index, rule: { ranges: [statusRange], booleanRule: { condition: { type: 'TEXT_EQ', values: [{ userEnteredValue: s }] }, format: { backgroundColor: STATUS_COLORS[s] } } } },
            })),
          ],
        },
      }, CALL);
    }
  }

  async appendRow(values: string[]) {
    const res = await this.api.spreadsheets.values.append({
      spreadsheetId: this.id, range: `${this.q}!${FIRST_COLUMN}1`, valueInputOption: 'RAW', insertDataOption: 'INSERT_ROWS',
      requestBody: { values: [values] },
    }, CALL);
    const m = /!(?:\$?[A-Z]+)(\d+)/.exec(res.data.updates?.updatedRange ?? '');
    if (!m) throw new Error('Google Sheets did not report which row was written');
    return Number(m[1]);
  }

  async readRows(): Promise<SheetRow[]> {
    const res = await this.api.spreadsheets.values.get({ spreadsheetId: this.id, range: `${this.q}!${FIRST_COLUMN}2:${LAST_COLUMN}`, majorDimension: 'ROWS', valueRenderOption: 'FORMATTED_VALUE' }, CALL);
    return (res.data.values ?? [])
      .map((cells, i) => ({ row: i + 2, cells: cells.map((c) => String(c ?? '')) }))
      .filter((r) => (r.cells[COL.submissionId] ?? '').trim() !== '');
  }

  private async locate(submissionId: string, hint: number | null): Promise<number | null> {
    if (hint && hint >= 2) {
      const r = await this.api.spreadsheets.values.get({ spreadsheetId: this.id, range: `${this.q}!${SUBMISSION_ID_COLUMN}${hint}` }, CALL);
      if ((r.data.values?.[0]?.[0] ?? '').trim() === submissionId) return hint;
    }
    // Row moved (admin sorted / inserted / deleted rows): find it by its ID again.
    const all = await this.api.spreadsheets.values.get({ spreadsheetId: this.id, range: `${this.q}!${SUBMISSION_ID_COLUMN}2:${SUBMISSION_ID_COLUMN}` }, CALL);
    const idx = (all.data.values ?? []).findIndex((r) => (r[0] ?? '').trim() === submissionId);
    return idx < 0 ? null : idx + 2;
  }

  async writeStatus(submissionId: string, hintRow: number | null, status: string, note: string, updatedAt: string) {
    const row = await this.locate(submissionId, hintRow);
    if (row === null) return null;
    await this.api.spreadsheets.values.batchUpdate({
      spreadsheetId: this.id,
      requestBody: {
        valueInputOption: 'RAW',
        data: [
          { range: `${this.q}!${STATUS_COLUMN}${row}`, values: [[status]] },
          { range: `${this.q}!${ADMIN_NOTE_COLUMN}${row}`, values: [[note]] },
          { range: `${this.q}!${UPDATED_AT_COLUMN}${row}`, values: [[updatedAt]] },
        ],
      },
    }, CALL);
    return row;
  }
}
