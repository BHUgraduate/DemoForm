import ExcelJS from 'exceljs';
import type { ReleaseRecord } from '../../shared/schema.ts';
import { COLUMNS, csvSafe } from './columns.ts';

export async function buildWorkbook(rows: ReleaseRecord[]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Soundlane Demo';
  wb.created = new Date();
  const ws = wb.addWorksheet('Submissions', { views: [{ state: 'frozen', ySplit: 1, xSplit: 1 }] });

  ws.columns = COLUMNS.map((c) => ({
    header: c.header,
    key: c.header,
    width: c.width,
    style: {
      alignment: { vertical: 'top', wrapText: c.kind === 'text' && c.width >= 28 },
      ...(c.kind === 'datetime' ? { numFmt: 'yyyy-mm-dd hh:mm' } : {}),
      ...(c.kind === 'date' ? { numFmt: 'yyyy-mm-dd' } : {}),
      ...(c.kind === 'mb' ? { numFmt: '0.00' } : {}),
    },
  }));

  for (const r of rows) {
    ws.addRow(
      COLUMNS.map((c) => {
        const v = c.value(r);
        if (v === null || v === undefined) return null;
        if (c.kind === 'mb') return Math.round(((v as number) / (1024 * 1024)) * 100) / 100;
        if (typeof v === 'string') return v === '' ? null : v;
        return v;
      }),
    );
  }

  const header = ws.getRow(1);
  header.height = 24;
  header.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF121212' } };
    cell.alignment = { vertical: 'middle', horizontal: 'left' };
  });
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: COLUMNS.length } };

  return Buffer.from(await wb.xlsx.writeBuffer());
}

export function buildCsv(rows: ReleaseRecord[]): string {
  const esc = (v: string) => (/[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const fmt = (c: (typeof COLUMNS)[number], r: ReleaseRecord) => {
    const v = c.value(r);
    if (v === null || v === undefined) return '';
    if (v instanceof Date) return c.kind === 'date' ? v.toISOString().slice(0, 10) : v.toISOString().replace('T', ' ').slice(0, 16);
    if (c.kind === 'mb') return String(Math.round(((v as number) / (1024 * 1024)) * 100) / 100);
    return typeof v === 'string' ? csvSafe(v) : String(v);
  };
  const lines = [COLUMNS.map((c) => esc(c.header)).join(',')];
  for (const r of rows) lines.push(COLUMNS.map((c) => esc(fmt(c, r))).join(','));
  return '﻿' + lines.join('\r\n') + '\r\n'; // BOM so Excel reads UTF-8 correctly
}

export const exportFilename = (ext: 'xlsx' | 'csv') => `music-distribution-submissions-${new Date().toISOString().slice(0, 10)}.${ext}`;
