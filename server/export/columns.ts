import type { ReleaseRecord } from '../../shared/schema.ts';

export type CellKind = 'text' | 'datetime' | 'date' | 'number' | 'mb';
export interface Column {
  header: string;
  width: number;
  kind: CellKind;
  value: (r: ReleaseRecord) => string | number | Date | null;
}

const toDate = (iso: string | undefined | null) => (iso ? new Date(iso) : null);
const join = (xs: string[]) => xs.join(', ');

/** One row per submission. Multi-value fields are comma-separated; no nested objects ever reach a cell. */
export const COLUMNS: Column[] = [
  { header: 'Submission ID', width: 18, kind: 'text', value: (r) => r.id },
  { header: 'Created At', width: 20, kind: 'datetime', value: (r) => toDate(r.createdAt) },
  { header: 'Artist Name', width: 24, kind: 'text', value: (r) => r.artist.legalName },
  { header: 'Artist Display Name', width: 24, kind: 'text', value: (r) => r.artist.displayName },
  { header: 'Email', width: 30, kind: 'text', value: (r) => r.artist.email },
  { header: 'Phone', width: 18, kind: 'text', value: (r) => r.artist.phone },
  { header: 'Country', width: 16, kind: 'text', value: (r) => r.artist.country },
  { header: 'State', width: 16, kind: 'text', value: (r) => r.artist.state },
  { header: 'City', width: 16, kind: 'text', value: (r) => r.artist.city },
  { header: 'Artist Type', width: 14, kind: 'text', value: (r) => r.artist.artistType },
  { header: 'Instagram', width: 22, kind: 'text', value: (r) => r.artist.instagram },
  { header: 'YouTube', width: 32, kind: 'text', value: (r) => r.artist.youtube },
  { header: 'Spotify URL', width: 36, kind: 'text', value: (r) => r.artist.spotifyUrl },
  { header: 'Apple Music URL', width: 36, kind: 'text', value: (r) => r.artist.appleMusicUrl },
  { header: 'Release Type', width: 13, kind: 'text', value: (r) => r.release.releaseType },
  { header: 'Release Title', width: 28, kind: 'text', value: (r) => r.release.title },
  { header: 'Primary Artist', width: 24, kind: 'text', value: (r) => r.release.primaryArtist },
  { header: 'Featuring Artists', width: 24, kind: 'text', value: (r) => r.release.featuringArtists },
  { header: 'Genre', width: 16, kind: 'text', value: (r) => r.release.genre },
  { header: 'Subgenre', width: 16, kind: 'text', value: (r) => r.release.subgenre },
  { header: 'Language', width: 14, kind: 'text', value: (r) => r.release.language },
  { header: 'Explicit', width: 10, kind: 'text', value: (r) => r.release.explicit },
  { header: 'Release Date', width: 14, kind: 'date', value: (r) => toDate(r.release.releaseDate) },
  { header: 'Original Release', width: 16, kind: 'text', value: (r) => r.release.originalRelease },
  { header: 'Previously Released', width: 18, kind: 'text', value: (r) => r.release.previouslyReleased },
  { header: 'Previous Release Date', width: 20, kind: 'date', value: (r) => toDate(r.release.previousReleaseDate) },
  { header: 'UPC', width: 18, kind: 'text', value: (r) => r.release.upc },
  { header: 'Songwriters', width: 28, kind: 'text', value: (r) => r.release.songwriters },
  { header: 'Composers', width: 28, kind: 'text', value: (r) => r.release.composers },
  { header: 'Lyricists', width: 28, kind: 'text', value: (r) => r.release.lyricists },
  { header: 'Producers', width: 28, kind: 'text', value: (r) => r.release.producers },
  { header: 'Copyright Owner', width: 28, kind: 'text', value: (r) => r.release.copyrightOwner },
  { header: 'Publishing Info', width: 30, kind: 'text', value: (r) => r.release.publishingInfo },
  { header: 'Track Count', width: 12, kind: 'number', value: (r) => r.tracks.length },
  { header: 'Track Titles', width: 40, kind: 'text', value: (r) => join(r.tracks.map((t) => `${t.trackNumber}. ${t.title}${t.version !== 'Original' ? ` (${t.version})` : ''}`)) },
  { header: 'ISRCs', width: 30, kind: 'text', value: (r) => join(r.tracks.map((t) => t.isrc).filter(Boolean)) },
  { header: 'Distribution Stores', width: 44, kind: 'text', value: (r) => join([...r.stores, ...(r.otherPlatforms ? [r.otherPlatforms] : [])]) },
  { header: 'Audio Filename', width: 28, kind: 'text', value: (r) => r.audio.originalName },
  { header: 'Audio MIME Type', width: 16, kind: 'text', value: (r) => r.audio.mimeType },
  { header: 'Audio Size (MB)', width: 15, kind: 'mb', value: (r) => r.audio.size },
  { header: 'Cover Filename', width: 28, kind: 'text', value: (r) => r.artwork.originalName },
  { header: 'Cover MIME Type', width: 16, kind: 'text', value: (r) => r.artwork.mimeType },
  { header: 'Cover Dimensions', width: 16, kind: 'text', value: (r) => (r.artwork.width && r.artwork.height ? `${r.artwork.width}x${r.artwork.height}` : '') },
  { header: 'Status', width: 14, kind: 'text', value: (r) => r.status },
  { header: 'Admin Note', width: 36, kind: 'text', value: (r) => r.adminNote },
  { header: 'Google Sheet Sync', width: 16, kind: 'text', value: (r) => r.googleSheetSyncStatus },
];

/**
 * CSV only: spreadsheet apps execute CSV cells beginning with = @ (or +/- followed by a non-number) as formulas.
 * .xlsx string cells are written as typed strings and are never evaluated, so they need no guard.
 */
export function csvSafe(v: string): string {
  return /^(?:[=@\t\r]|[+\-](?![\d\s().]))/.test(v) ? `'${v}` : v;
}
