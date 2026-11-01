import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { Server } from 'node:http';
import { createApp } from '../../server/app.ts';
import { LocalFileStorage } from '../../server/storage/fileStorage.ts';
import { JsonReleaseRepository } from '../../server/storage/releaseRepository.ts';
import { JsonUserRepository } from '../../server/storage/userRepository.ts';
import { hashPassword } from '../../server/auth/security.ts';
import { GoogleSheetsGateway } from '../../server/sheets/gateway.ts';
import { SheetsSync } from '../../server/sheets/sync.ts';
import { FakeSheets } from './fakeSheets.ts';

export const PW = 'correct-horse-9';

export async function startHarness(opts: { sheets: boolean }) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'soundlane-test-'));
  const releases = new JsonReleaseRepository(dir);
  const users = new JsonUserRepository(dir);
  const files = new LocalFileStorage(dir);
  const fake = opts.sheets ? await new FakeSheets().start() : null;
  const logs: string[] = [];
  const gateway = fake ? new GoogleSheetsGateway({ spreadsheetId: fake.spreadsheetId, worksheetName: 'Releases', emulatorUrl: fake.url }) : null;
  const sync = new SheetsSync(releases, gateway, (m) => logs.push(m));

  await users.create({ name: 'Test Artist', email: 'artist@example.com', role: 'artist', passwordHash: await hashPassword(PW) });
  await users.create({ name: 'Other Artist', email: 'other@example.com', role: 'artist', passwordHash: await hashPassword(PW) });
  await users.create({ name: 'Admin', email: 'admin@example.com', role: 'admin', passwordHash: await hashPassword(PW) });

  const app = createApp({ releases, files, users, sync, secret: () => 'test-secret' });
  let server!: Server;
  await new Promise<void>((r) => { server = app.listen(0, () => r()); });
  const base = `http://localhost:${(server.address() as any).port}/api`;

  async function login(email: string): Promise<string> {
    const res = await fetch(`${base}/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password: PW }) });
    if (res.status !== 200) throw new Error('login failed ' + res.status);
    return res.headers.get('set-cookie')!.split(';')[0];
  }
  const call = (cookie: string | null) => async (p: string, init: RequestInit & { json?: unknown } = {}) => {
    const headers: Record<string, string> = { ...(init.headers as any) };
    if (cookie) headers.cookie = cookie;
    if (init.json !== undefined) { headers['content-type'] = 'application/json'; init.body = JSON.stringify(init.json); }
    const res = await fetch(`${base}${p}`, { ...init, headers });
    const bytes = Buffer.from(await res.arrayBuffer());
    const text = bytes.toString();
    let body: any = null; try { body = JSON.parse(text); } catch { /* binary */ }
    return { status: res.status, body, res, text, bytes };
  };

  async function upload(cookie: string, kind: 'audio' | 'artwork', file: string, name: string) {
    const fd = new FormData();
    fd.append('file', new Blob([fs.readFileSync(file)]), name);
    const res = await fetch(`${base}/uploads/${kind}`, { method: 'POST', body: fd, headers: { cookie } });
    return { status: res.status, body: (await res.json()) as any };
  }

  const payload = (audioFileId: string, artworkFileId: string, over: any = {}) => ({
    artist: { legalName: ' Test  Artist ', displayName: 'Tester', email: 'artist@example.com', phone: '+1 555 010 0100', country: 'India', artistType: 'Solo Artist' },
    release: { releaseType: 'Single', title: 'Test Song', primaryArtist: 'Tester', genre: 'Pop', language: 'English', explicit: 'No', releaseDate: '2026-12-01', originalRelease: 'Yes', previouslyReleased: 'No', songwriters: 'A', composers: 'B', copyrightOwner: 'Tester' },
    tracks: [{ title: 'Song', version: 'Original', trackNumber: 1, primaryArtist: 'Tester', language: 'English', explicit: 'No', songwriter: 'A', composer: 'B' }],
    files: { audioFileId, artworkFileId },
    stores: ['Spotify', 'Tidal'],
    rights: { ownsRights: true, infoAccurate: true, authorizeProcessing: true },
    ...over,
  });

  /** Uploads sample files and submits a release as `cookie`'s user. */
  async function submit(cookie: string, title = 'Test Song', over: any = {}) {
    const a = await upload(cookie, 'audio', 'demo-assets/sample-track.wav', 'song.wav');
    const c = await upload(cookie, 'artwork', 'demo-assets/sample-cover.png', 'cover.png');
    const p = payload(a.body.file.id, c.body.file.id, over);
    p.release = { ...p.release, title, ...(over.release ?? {}) };
    return call(cookie)('/releases', { method: 'POST', json: p });
  }

  return {
    dir, base, fake, sync, releases, users, logs, login, call, upload, payload, submit,
    async stop() { server.close(); await fake?.stop(); fs.rmSync(dir, { recursive: true, force: true }); },
  };
}
export type Harness = Awaited<ReturnType<typeof startHarness>>;
