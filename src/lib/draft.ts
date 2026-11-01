import type { StoreName } from '../../shared/schema';

export interface UploadedMeta {
  id: string;
  originalName: string;
  mimeType: string;
  size: number;
  uploadedAt: string;
  width?: number;
  height?: number;
}

export interface TrackDraft {
  title: string; version: string; trackNumber: number; primaryArtist: string; featuredArtists: string;
  isrc: string; language: string; explicit: string; songwriter: string; composer: string; lyricist: string; producer: string; lyrics: string;
}

export interface Draft {
  artist: {
    legalName: string; displayName: string; email: string; phone: string; country: string; state: string; city: string;
    artistType: string; instagram: string; youtube: string; spotifyUrl: string; appleMusicUrl: string;
  };
  release: {
    releaseType: string; title: string; primaryArtist: string; featuringArtists: string; genre: string; subgenre: string;
    language: string; explicit: string; releaseDate: string; originalRelease: string; previouslyReleased: string;
    previousReleaseDate: string; upc: string; songwriters: string; composers: string; lyricists: string; producers: string;
    copyrightOwner: string; publishingInfo: string;
  };
  tracks: TrackDraft[];
  audio: UploadedMeta | null;
  artwork: UploadedMeta | null;
  stores: StoreName[];
  otherPlatforms: string;
  rights: { ownsRights: boolean; infoAccurate: boolean; authorizeProcessing: boolean };
}

export const newTrack = (n: number, primaryArtist = ''): TrackDraft => ({
  title: '', version: 'Original', trackNumber: n, primaryArtist, featuredArtists: '', isrc: '', language: '', explicit: '', songwriter: '', composer: '', lyricist: '', producer: '', lyrics: '',
});

export const emptyDraft = (): Draft => ({
  artist: { legalName: '', displayName: '', email: '', phone: '', country: '', state: '', city: '', artistType: '', instagram: '', youtube: '', spotifyUrl: '', appleMusicUrl: '' },
  release: { releaseType: '', title: '', primaryArtist: '', featuringArtists: '', genre: '', subgenre: '', language: '', explicit: '', releaseDate: '', originalRelease: '', previouslyReleased: '', previousReleaseDate: '', upc: '', songwriters: '', composers: '', lyricists: '', producers: '', copyrightOwner: '', publishingInfo: '' },
  tracks: [newTrack(1)],
  audio: null, artwork: null, stores: [], otherPlatforms: '',
  rights: { ownsRights: false, infoAccurate: false, authorizeProcessing: false },
});

/** The exact JSON body sent to POST /api/releases. Only file *ids* travel here; bytes were uploaded separately. */
export function toPayload(d: Draft) {
  return {
    artist: d.artist, release: d.release, tracks: d.tracks,
    files: { audioFileId: d.audio?.id ?? '', artworkFileId: d.artwork?.id ?? '' },
    stores: d.stores, otherPlatforms: d.otherPlatforms, rights: d.rights,
  };
}

/* Autosave: a convenience draft in this browser only. The *submission* always goes to the backend. */
const KEY = 'soundlane-demo-draft-v2';
export function loadDraft(): { draft: Draft; step: number } | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.draft ? { draft: { ...emptyDraft(), ...parsed.draft }, step: Number(parsed.step) || 0 } : null;
  } catch { return null; }
}
export const saveDraft = (draft: Draft, step: number) => { try { localStorage.setItem(KEY, JSON.stringify({ draft, step })); } catch { /* storage full/blocked: ignore */ } };
export const clearDraft = () => { try { localStorage.removeItem(KEY); } catch { /* ignore */ } };
