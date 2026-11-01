import type { ReleaseRecord, StoredFile } from '../shared/schema.ts';
import type { ReleaseRepository } from './storage/releaseRepository.ts';
import type { JsonUserRepository } from './storage/userRepository.ts';
import { config } from './config.ts';
import { DEMO_ARTIST_PASSWORD } from './routes/auth.ts';
import { hashPassword } from './auth/security.ts';

/**
 * DEMO DATA — fictional people only (example.com addresses, reserved 555-01xx style numbers).
 * Every row is flagged isDemoData: true and is inserted only when the store is empty.
 */
const file = (originalName: string, mimeType: string, size: number, at: string, dims?: [number, number]): StoredFile => ({
  originalName, mimeType, size, uploadedAt: at, available: false, ...(dims ? { width: dims[0], height: dims[1] } : {}),
});

const NIL = '00000000-0000-0000-0000-000000000000';

const SAMPLE = { userId: 'seed', otherPlatforms: '', adminNote: '', googleSheetRow: null, googleSheetLastSyncedStatus: null, googleSheetLastSyncedNote: '', googleSheetSyncStatus: 'skipped' } as const;

const rows: Array<Omit<ReleaseRecord, 'id' | keyof typeof SAMPLE> & { id: string; adminNote?: string }> = [
  {
    id: 'REL-2026-00001', createdAt: '2026-10-24T09:12:00.000Z', updatedAt: '2026-10-25T10:00:00.000Z', status: 'Approved', adminNote: 'Approved for distribution (sample note).', isDemoData: true,
    artist: { legalName: 'Aarav Mehta', displayName: 'Aarav M.', email: 'aarav.demo@example.com', phone: '+91 98765 43210', country: 'India', state: 'Maharashtra', city: 'Mumbai', artistType: 'Solo Artist', instagram: '@aarav.demo', youtube: 'https://youtube.com/@aarav-demo', spotifyUrl: 'https://open.spotify.com/artist/demo-aarav', appleMusicUrl: '' },
    release: { releaseType: 'Single', title: 'Monsoon Static', primaryArtist: 'Aarav M.', featuringArtists: '', genre: 'Indie', subgenre: 'Dream Pop', language: 'English', explicit: 'No', releaseDate: '2026-11-20', originalRelease: 'Yes', previouslyReleased: 'No', previousReleaseDate: '', upc: '', songwriters: 'Aarav Mehta', composers: 'Aarav Mehta', lyricists: 'Aarav Mehta', producers: 'Neel Kapoor', copyrightOwner: 'Aarav Mehta', publishingInfo: 'Self-published' },
    tracks: [{ title: 'Monsoon Static', version: 'Original', trackNumber: 1, primaryArtist: 'Aarav M.', featuredArtists: '', isrc: '', language: 'English', explicit: 'No', songwriter: '', composer: '', lyricist: '', producer: '', lyrics: '' }],
    files: { audioFileId: NIL, artworkFileId: NIL }, stores: ['Spotify', 'Apple Music', 'YouTube Music', 'Deezer', 'Tidal'],
    rights: { ownsRights: true, infoAccurate: true, authorizeProcessing: true },
    audio: file('monsoon-static-master.wav', 'audio/wav', 38_420_000, '2026-10-24T09:09:00.000Z'),
    artwork: file('monsoon-static-cover.png', 'image/png', 2_104_000, '2026-10-24T09:10:00.000Z', [3000, 3000]),
  },
  {
    id: 'REL-2026-00002', createdAt: '2026-10-27T14:40:00.000Z', updatedAt: '2026-10-27T16:05:00.000Z', status: 'Needs Changes', adminNote: 'Please upload a higher-resolution cover image (sample note).', isDemoData: true,
    artist: { legalName: 'Riya Sharma', displayName: 'Riya Sharma', email: 'riya.demo@example.com', phone: '+91 91234 56789', country: 'India', state: 'Delhi', city: 'New Delhi', artistType: 'Solo Artist', instagram: '@riya.sings.demo', youtube: '', spotifyUrl: '', appleMusicUrl: 'https://music.apple.com/artist/demo-riya' },
    release: { releaseType: 'EP', title: 'Late Train Letters', primaryArtist: 'Riya Sharma', featuringArtists: 'Kabir Anand', genre: 'Pop', subgenre: 'Acoustic Pop', language: 'Hindi', explicit: 'No', releaseDate: '2026-12-05', originalRelease: 'Yes', previouslyReleased: 'Yes', previousReleaseDate: '2026-03-14', upc: '000000000001', songwriters: 'Riya Sharma, Kabir Anand', composers: 'Riya Sharma', lyricists: 'Riya Sharma', producers: 'Studio Seven (demo)', copyrightOwner: 'Riya Sharma', publishingInfo: 'Self-published' },
    tracks: [
      { title: 'Platform Nine', version: 'Original', trackNumber: 1, primaryArtist: 'Riya Sharma', featuredArtists: '', isrc: 'ZZ-DEM-26-00001', language: 'Hindi', explicit: 'No', songwriter: '', composer: '', lyricist: '', producer: '', lyrics: '' },
      { title: 'Chai Going Cold', version: 'Acoustic', trackNumber: 2, primaryArtist: 'Riya Sharma', featuredArtists: 'Kabir Anand', isrc: 'ZZ-DEM-26-00002', language: 'Hindi', explicit: 'No', songwriter: '', composer: '', lyricist: '', producer: '', lyrics: '' },
      { title: 'Last Window Seat', version: 'Original', trackNumber: 3, primaryArtist: 'Riya Sharma', featuredArtists: '', isrc: 'ZZ-DEM-26-00003', language: 'Hindi', explicit: 'No', songwriter: '', composer: '', lyricist: '', producer: '', lyrics: '' },
    ],
    files: { audioFileId: NIL, artworkFileId: NIL }, stores: ['Spotify', 'Apple Music', 'Amazon Music', 'Instagram / Meta', 'TikTok'],
    rights: { ownsRights: true, infoAccurate: true, authorizeProcessing: true },
    audio: file('late-train-letters-ep.flac', 'audio/flac', 112_600_000, '2026-10-27T14:31:00.000Z'),
    artwork: file('ltl-cover.jpg', 'image/jpeg', 1_380_000, '2026-10-27T14:35:00.000Z', [3000, 3000]),
  },
  {
    id: 'REL-2026-00003', createdAt: '2026-10-29T18:05:00.000Z', updatedAt: '2026-10-29T18:05:00.000Z', status: 'Under Review', isDemoData: true,
    artist: { legalName: 'The Midnight Theory (demo band)', displayName: 'The Midnight Theory', email: 'band.demo@example.com', phone: '+1 555 010 0199', country: 'United States', state: 'Oregon', city: 'Portland', artistType: 'Band', instagram: '@midnighttheory.demo', youtube: 'https://youtube.com/@midnight-theory-demo', spotifyUrl: 'https://open.spotify.com/artist/demo-mt', appleMusicUrl: 'https://music.apple.com/artist/demo-mt' },
    release: { releaseType: 'Album', title: 'Quiet Frequencies', primaryArtist: 'The Midnight Theory', featuringArtists: '', genre: 'Alternative', subgenre: 'Post-Rock', language: 'English', explicit: 'Yes', releaseDate: '2027-01-16', originalRelease: 'Yes', previouslyReleased: 'No', previousReleaseDate: '', upc: '', songwriters: 'J. Calder, M. Okafor', composers: 'The Midnight Theory', lyricists: 'J. Calder', producers: 'M. Okafor', copyrightOwner: 'Midnight Theory LLC (demo)', publishingInfo: 'Administered by Fictional Publishing Co.' },
    tracks: [
      { title: 'Signal Fade', version: 'Original', trackNumber: 1, primaryArtist: 'The Midnight Theory', featuredArtists: '', isrc: 'ZZ-DEM-26-00011', language: 'English', explicit: 'No', songwriter: '', composer: '', lyricist: '', producer: '', lyrics: '' },
      { title: 'Concrete Weather', version: 'Original', trackNumber: 2, primaryArtist: 'The Midnight Theory', featuredArtists: '', isrc: 'ZZ-DEM-26-00012', language: 'English', explicit: 'Yes', songwriter: '', composer: '', lyricist: '', producer: '', lyrics: '' },
      { title: 'Quiet Frequencies', version: 'Instrumental', trackNumber: 3, primaryArtist: 'The Midnight Theory', featuredArtists: '', isrc: 'ZZ-DEM-26-00013', language: 'Instrumental (no lyrics)', explicit: 'No', songwriter: '', composer: '', lyricist: '', producer: '', lyrics: '' },
      { title: 'Low Tide Radio', version: 'Radio Edit', trackNumber: 4, primaryArtist: 'The Midnight Theory', featuredArtists: '', isrc: 'ZZ-DEM-26-00014', language: 'English', explicit: 'No', songwriter: '', composer: '', lyricist: '', producer: '', lyrics: '' },
    ],
    files: { audioFileId: NIL, artworkFileId: NIL }, stores: ['Spotify', 'Apple Music', 'YouTube Music', 'Amazon Music', 'Deezer', 'Tidal', 'Pandora'],
    rights: { ownsRights: true, infoAccurate: true, authorizeProcessing: true },
    audio: file('quiet-frequencies-full-album.wav', 'audio/wav', 412_000_000, '2026-10-29T17:52:00.000Z'),
    artwork: file('qf-cover.png', 'image/png', 3_900_000, '2026-10-29T17:58:00.000Z', [3000, 3000]),
  },
];

/** The admin account always exists (you cannot sign in to /admin otherwise). The demo artist only when seeding demo data. */
export async function seedUsers(users: JsonUserRepository) {
  if (!(await users.findByEmail(config.auth.adminEmail))) {
    await users.create({ name: 'Demo Admin', email: config.auth.adminEmail, role: 'admin', passwordHash: await hashPassword(config.auth.adminPassword) });
    console.log(`[seed] created admin account ${config.auth.adminEmail}`);
  }
  if (config.seedDemoData && !(await users.findByEmail('artist@example.com'))) {
    await users.create({ name: 'Demo Artist', email: 'artist@example.com', role: 'artist', passwordHash: await hashPassword(DEMO_ARTIST_PASSWORD) });
    console.log('[seed] created demo artist artist@example.com');
  }
}

export async function seedDemoData(repo: ReleaseRepository) {
  if ((await repo.count()) > 0) return;
  for (const row of rows) {
    // create() assigns sequential ids, which line up with the ids above because the store is empty.
    await repo.create((id) => ({ ...SAMPLE, ...row, id }));
  }
  console.log(`[seed] inserted ${rows.length} fictional demo submissions (isDemoData: true)`);
}
