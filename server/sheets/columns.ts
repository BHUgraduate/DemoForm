import type { ReleaseRecord } from '../../shared/schema.ts';

/**
 * THE one place that defines the Google Sheet layout. Never hard-code a column letter or index elsewhere:
 * add/reorder columns here and everything (header, append, status write-back, poller) follows.
 */
export const SHEET_COLUMNS = [
  { key: 'submissionId', header: 'Submission ID' },   // A  ← synchronisation key
  { key: 'userId', header: 'User ID' },                // B
  { key: 'artistName', header: 'Artist Name' },        // C
  { key: 'artistEmail', header: 'Artist Email' },      // D
  { key: 'phone', header: 'Phone' },                   // E
  { key: 'releaseTitle', header: 'Release Title' },    // F
  { key: 'releaseType', header: 'Release Type' },      // G
  { key: 'genre', header: 'Genre' },                   // H
  { key: 'language', header: 'Language' },             // I
  { key: 'releaseDate', header: 'Release Date' },      // J
  { key: 'trackCount', header: 'Track Count' },        // K
  { key: 'platforms', header: 'Distribution Platforms' }, // L
  { key: 'audioFile', header: 'Audio File' },          // M
  { key: 'coverArtwork', header: 'Cover Artwork' },    // N
  { key: 'status', header: 'Status' },                 // O  ← admin edits this
  { key: 'adminNote', header: 'Admin Note' },          // P  ← admin edits this
  { key: 'createdAt', header: 'Created At' },          // Q
  { key: 'updatedAt', header: 'Updated At' },          // R
] as const;

export type ColumnKey = (typeof SHEET_COLUMNS)[number]['key'];

/** Zero-based index of each column, e.g. COL.status === 14 */
export const COL = Object.fromEntries(SHEET_COLUMNS.map((c, i) => [c.key, i])) as Record<ColumnKey, number>;

export function colLetter(index: number): string {
  let n = index + 1, out = '';
  while (n > 0) { const r = (n - 1) % 26; out = String.fromCharCode(65 + r) + out; n = Math.floor((n - 1) / 26); }
  return out;
}

export const SUBMISSION_ID_COLUMN = colLetter(COL.submissionId);
export const USER_ID_COLUMN = colLetter(COL.userId);
export const STATUS_COLUMN = colLetter(COL.status);
export const ADMIN_NOTE_COLUMN = colLetter(COL.adminNote);
export const UPDATED_AT_COLUMN = colLetter(COL.updatedAt);
export const FIRST_COLUMN = colLetter(0);
export const LAST_COLUMN = colLetter(SHEET_COLUMNS.length - 1);
export const HEADERS: string[] = SHEET_COLUMNS.map((c) => c.header);

/** Sheet cells are always plain text (written RAW) so user-entered text can never become a formula. */
export function releaseToRow(r: ReleaseRecord): string[] {
  const byKey: Record<ColumnKey, string> = {
    submissionId: r.id,
    userId: r.userId,
    artistName: r.artist.displayName || r.artist.legalName,
    artistEmail: r.artist.email,
    phone: r.artist.phone,
    releaseTitle: r.release.title,
    releaseType: r.release.releaseType,
    genre: r.release.genre,
    language: r.release.language,
    releaseDate: r.release.releaseDate,
    trackCount: String(r.tracks.length),
    platforms: [...r.stores, ...(r.otherPlatforms ? [r.otherPlatforms] : [])].join(', '),
    audioFile: r.audio.originalName,
    coverArtwork: r.artwork.originalName,
    status: r.status,
    adminNote: r.adminNote,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
  return SHEET_COLUMNS.map((c) => byKey[c.key]);
}
