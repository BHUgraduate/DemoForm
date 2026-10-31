/**
 * Shared types, constants and validation schemas.
 * Imported by BOTH the React app (per-step validation) and the Express API
 * (authoritative validation) so the rules cannot drift apart.
 */
import { z } from 'zod';

/* ───────────────────────── constants ───────────────────────── */

export const ARTIST_TYPES = ['Solo Artist', 'Band', 'Label', 'Producer', 'Other'] as const;
export const RELEASE_TYPES = ['Single', 'EP', 'Album'] as const;
export const TRACK_VERSIONS = ['Original', 'Remix', 'Live', 'Acoustic', 'Instrumental', 'Radio Edit', 'Other'] as const;
export const STATUSES = ['Submitted', 'Under Review', 'Approved', 'Rejected'] as const;
export const STORES = [
  'Spotify', 'Apple Music', 'YouTube Music', 'Amazon Music', 'Deezer', 'TikTok', 'Instagram / Meta', 'Tidal', 'Pandora',
] as const;
export const GENRES = [
  'Pop', 'Hip-Hop / Rap', 'R&B / Soul', 'Rock', 'Alternative', 'Indie', 'Electronic', 'Dance', 'House', 'Lo-fi',
  'Jazz', 'Classical', 'Folk', 'Country', 'Latin', 'Reggae', 'Afrobeats', 'Bollywood', 'Punjabi', 'Devotional', 'Ambient', 'Metal', 'Other',
] as const;
export const LANGUAGES = [
  'English', 'Hindi', 'Punjabi', 'Tamil', 'Telugu', 'Bengali', 'Marathi', 'Gujarati', 'Spanish', 'French', 'German',
  'Portuguese', 'Korean', 'Japanese', 'Arabic', 'Instrumental (no lyrics)', 'Other',
] as const;

export const AUDIO_EXTENSIONS = ['mp3', 'wav', 'flac'] as const;
export const AUDIO_MIME_TYPES = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav', 'audio/wave', 'audio/flac', 'audio/x-flac'] as const;
export const ARTWORK_EXTENSIONS = ['jpg', 'jpeg', 'png'] as const;
export const ARTWORK_MIME_TYPES = ['image/jpeg', 'image/png'] as const;
export const ARTWORK_MIN_PX = 1400; // recommended minimum for a real DSP; demo only warns

export type ArtistType = (typeof ARTIST_TYPES)[number];
export type ReleaseType = (typeof RELEASE_TYPES)[number];
export type Status = (typeof STATUSES)[number];
export type StoreName = (typeof STORES)[number];

/* ───────────────────────── helpers ───────────────────────── */

/** Strip control characters + collapse whitespace; the server never trusts raw client text. */
export function sanitizeText(value: string): string {
  // eslint-disable-next-line no-control-regex
  return value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').replace(/[ \t]+/g, ' ').trim();
}

const text = (label: string, max = 200) =>
  z.string({ required_error: `${label} is required`, invalid_type_error: `${label} is required` })
    .transform(sanitizeText)
    .pipe(z.string().max(max, `${label} must be ${max} characters or fewer`));

const required = (label: string, max = 200) =>
  text(label, max).pipe(z.string().min(1, `${label} is required`));

const optional = (max = 200) =>
  z.string().optional().default('').transform(sanitizeText).pipe(z.string().max(max, `Must be ${max} characters or fewer`));

const optionalUrl = (label: string) =>
  optional(300).refine((v) => v === '' || /^https?:\/\/[^\s]+\.[^\s]+$/i.test(v), `${label} must be a valid URL starting with http(s)://`);

const isoDate = (label: string) =>
  z.string({ required_error: `${label} is required`, invalid_type_error: `${label} is required` })
    .refine((v) => /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)), `${label} must be a valid date`);

const yesNo = z.enum(['Yes', 'No'], { errorMap: () => ({ message: 'Please choose Yes or No' }) });

/* ───────────────────────── sections ───────────────────────── */

export const artistSchema = z.object({
  legalName: required('Legal name'),
  displayName: required('Artist display name'),
  email: required('Email', 254).pipe(z.string().email('Enter a valid email address')),
  phone: required('Phone number', 30).pipe(z.string().regex(/^[+()\-.\s\d]{7,30}$/, 'Enter a valid phone number')),
  country: required('Country'),
  state: optional(100),
  city: optional(100),
  artistType: z.enum(ARTIST_TYPES, { errorMap: () => ({ message: 'Choose an artist type' }) }),
  instagram: optional(150),
  youtube: optionalUrl('YouTube URL'),
  spotifyUrl: optionalUrl('Spotify URL'),
  appleMusicUrl: optionalUrl('Apple Music URL'),
});

export const releaseSchema = z.object({
  releaseType: z.enum(RELEASE_TYPES, { errorMap: () => ({ message: 'Choose a release type' }) }),
  title: required('Release title'),
  primaryArtist: required('Primary artist'),
  featuringArtists: optional(300),
  genre: required('Genre', 100),
  subgenre: optional(100),
  language: required('Language', 100),
  explicit: yesNo,
  releaseDate: isoDate('Release date'),
  originalRelease: yesNo,
  previouslyReleased: yesNo,
  previousReleaseDate: optional(10),
  upc: optional(40),
  songwriters: required('Songwriter(s)', 300),
  composers: required('Composer(s)', 300),
  lyricists: optional(300),
  producers: optional(300),
  copyrightOwner: required('Copyright owner'),
  publishingInfo: optional(500),
}).superRefine((r, ctx) => {
  if (r.previouslyReleased === 'Yes') {
    if (!r.previousReleaseDate) {
      ctx.addIssue({ code: 'custom', path: ['previousReleaseDate'], message: 'Previous release date is required' });
    } else if (!/^\d{4}-\d{2}-\d{2}$/.test(r.previousReleaseDate) || Number.isNaN(Date.parse(r.previousReleaseDate))) {
      ctx.addIssue({ code: 'custom', path: ['previousReleaseDate'], message: 'Previous release date must be a valid date' });
    }
  }
});

export const trackSchema = z.object({
  title: required('Track title'),
  version: z.enum(TRACK_VERSIONS, { errorMap: () => ({ message: 'Choose a version' }) }),
  trackNumber: z.coerce.number({ invalid_type_error: 'Track number is required' }).int('Must be a whole number').min(1, 'Must be 1 or higher').max(99),
  primaryArtist: required('Primary artist'),
  featuredArtists: optional(300),
  isrc: optional(20).refine(
    (v) => v === '' || /^[A-Z]{2}-?[A-Z0-9]{3}-?\d{2}-?\d{5}$/i.test(v),
    'ISRC format looks like US-ABC-26-00001',
  ),
  language: required('Language', 100),
  explicit: yesNo,
  lyrics: optional(10000),
});

export const tracksSchema = z.array(trackSchema).min(1, 'Add at least one track').max(40)
  .superRefine((tracks, ctx) => {
    const seen = new Set<number>();
    tracks.forEach((t, i) => {
      if (seen.has(t.trackNumber)) {
        ctx.addIssue({ code: 'custom', path: [i, 'trackNumber'], message: 'Track numbers must be unique' });
      }
      seen.add(t.trackNumber);
    });
  });

export const storesSchema = z.array(z.enum(STORES)).min(1, 'Select at least one store');

export const rightsSchema = z.object({
  ownsRights: z.literal(true, { errorMap: () => ({ message: 'You must confirm you control the rights' }) }),
  infoAccurate: z.literal(true, { errorMap: () => ({ message: 'You must confirm the information is accurate' }) }),
  authorizeProcessing: z.literal(true, { errorMap: () => ({ message: 'You must authorize processing' }) }),
});

const fileId = (label: string) =>
  z.string({ required_error: `${label} is required`, invalid_type_error: `${label} is required` })
    .regex(/^[a-f0-9-]{36}$/, `${label} is required`);

export const filesSchema = z.object({
  audioFileId: fileId('Audio file'),
  artworkFileId: fileId('Cover artwork'),
});

/** The complete payload POSTed to /api/releases. File bytes are uploaded separately; only their ids travel here. */
export const releaseSubmissionSchema = z.object({
  artist: artistSchema,
  release: releaseSchema,
  tracks: tracksSchema,
  files: filesSchema,
  stores: storesSchema,
  rights: rightsSchema,
});

/* ───────────────────────── types ───────────────────────── */

export type ArtistInput = z.input<typeof artistSchema>;
export type Artist = z.output<typeof artistSchema>;
export type Release = z.output<typeof releaseSchema>;
export type Track = z.output<typeof trackSchema>;
export type SubmissionPayload = z.output<typeof releaseSubmissionSchema>;

export interface StoredFile {
  originalName: string;
  mimeType: string;
  size: number;
  uploadedAt: string;
  /** Present for artwork. */
  width?: number;
  height?: number;
  /** false for seeded demo rows whose bytes were never uploaded. */
  available: boolean;
}

export interface ReleaseRecord extends SubmissionPayload {
  id: string; // REL-2026-00001
  createdAt: string;
  updatedAt: string;
  status: Status;
  audio: StoredFile;
  artwork: StoredFile;
  /** true only for the fictional rows inserted by server/seed.ts */
  isDemoData: boolean;
}

export interface Stats {
  total: number;
  submitted: number;
  underReview: number;
  approved: number;
  rejected: number;
}

export interface SubmitResponse {
  success: boolean;
  submissionId?: string;
  status?: Status;
  message: string;
  fieldErrors?: Record<string, string>;
}

/** Flatten a ZodError into { "artist.email": "Enter a valid email" } (first message per path wins). */
export function flattenIssues(issues: z.ZodIssue[], prefix = ''): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of issues) {
    const key = [prefix, ...issue.path].filter((p) => p !== '').join('.');
    if (!(key in out)) out[key] = issue.message;
  }
  return out;
}
