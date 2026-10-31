import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { Server } from 'node:http';
import ExcelJS from 'exceljs';
import { createApp } from '../server/app.ts';
import { LocalFileStorage } from '../server/storage/fileStorage.ts';
import { JsonReleaseRepository } from '../server/storage/releaseRepository.ts';

let server: Server, base: string, dir: string;

before(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'soundlane-test-'));
  const app = createApp({ releases: new JsonReleaseRepository(dir), files: new LocalFileStorage(dir) });
  await new Promise<void>((r) => { server = app.listen(0, () => r()); });
  base = `http://localhost:${(server.address() as any).port}/api`;
});
after(() => { server.close(); fs.rmSync(dir, { recursive: true, force: true }); });

async function upload(kind: 'audio' | 'artwork', file: string, name: string) {
  const fd = new FormData();
  fd.append('file', new Blob([fs.readFileSync(file)]), name);
  const res = await fetch(`${base}/uploads/${kind}`, { method: 'POST', body: fd });
  return { status: res.status, body: (await res.json()) as any };
}

const payload = (audioFileId: string, artworkFileId: string, over: any = {}) => ({
  artist: { legalName: ' Test  Artist ', displayName: 'Tester', email: 'tester@example.com', phone: '+1 555 010 0100', country: 'India', artistType: 'Solo Artist' },
  release: { releaseType: 'Single', title: '=HYPERLINK("x")', primaryArtist: 'Tester', genre: 'Pop', language: 'English', explicit: 'No', releaseDate: '2026-12-01', originalRelease: 'Yes', previouslyReleased: 'No', songwriters: 'A', composers: 'B', copyrightOwner: 'Tester' },
  tracks: [{ title: 'Song', version: 'Original', trackNumber: 1, primaryArtist: 'Tester', language: 'English', explicit: 'No' }],
  files: { audioFileId, artworkFileId },
  stores: ['Spotify', 'Tidal'],
  rights: { ownsRights: true, infoAccurate: true, authorizeProcessing: true },
  ...over,
});

test('rejects wrong file types and spoofed content', async () => {
  fs.writeFileSync(path.join(dir, 'x.pdf'), 'hello');
  assert.equal((await upload('audio', path.join(dir, 'x.pdf'), 'a.pdf')).status, 415);
  assert.equal((await upload('audio', path.join(dir, 'x.pdf'), 'fake.mp3')).status, 415); // right ext, wrong bytes
  assert.equal((await upload('artwork', 'demo-assets/sample-track.wav', 'cover.png')).status, 415);
});

test('full flow: upload → submit → persisted → admin → status → xlsx', async () => {
  const a = await upload('audio', 'demo-assets/sample-track.wav', 'song.wav');
  const c = await upload('artwork', 'demo-assets/sample-cover.png', 'cover.png');
  assert.equal(a.status, 201); assert.equal(c.body.file.width, 1600);

  const post = (b: unknown) => fetch(`${base}/releases`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) });

  // validation
  const bad = await post(payload(a.body.file.id, c.body.file.id, { artist: { ...payload('', '').artist, email: 'nope' }, rights: { ownsRights: false, infoAccurate: true, authorizeProcessing: true } }));
  assert.equal(bad.status, 400);
  const badBody = (await bad.json()) as any;
  assert.ok(badBody.fieldErrors['artist.email']); assert.ok(badBody.fieldErrors['rights.ownsRights']);
  assert.equal((await post(payload('11111111-1111-1111-1111-111111111111', c.body.file.id))).status, 400); // unknown file id

  // success
  const ok = await post(payload(a.body.file.id, c.body.file.id));
  const okBody = (await ok.json()) as any;
  assert.equal(ok.status, 201);
  assert.match(okBody.submissionId, new RegExp(`^REL-${new Date().getFullYear()}-00001$`));

  // duplicate
  assert.equal((await post(payload(a.body.file.id, c.body.file.id))).status, 409);

  // admin list/detail/filter/stats
  const list = (await (await fetch(`${base}/admin/releases?search=tester@example`)).json()) as any;
  assert.equal(list.releases.length, 1);
  assert.equal(list.releases[0].artist.legalName, 'Test Artist'); // sanitised
  assert.equal(list.releases[0].audio.mimeType, 'audio/wav');       // server-derived metadata
  assert.equal(((await (await fetch(`${base}/admin/releases?status=Approved`)).json()) as any).releases.length, 0);
  assert.equal(((await (await fetch(`${base}/admin/stats`)).json()) as any).stats.submitted, 1);

  // status change
  const patch = await fetch(`${base}/admin/releases/${okBody.submissionId}/status`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ status: 'Approved' }) });
  assert.equal(patch.status, 200);
  assert.equal(((await (await fetch(`${base}/admin/stats`)).json()) as any).stats.approved, 1);
  assert.equal((await fetch(`${base}/admin/releases/${okBody.submissionId}/status`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ status: 'Bogus' }) })).status, 400);

  // stored upload can be retrieved
  const art = await fetch(`${base}/admin/releases/${okBody.submissionId}/files/artwork`);
  assert.equal(art.headers.get('content-type'), 'image/png');

  // xlsx
  const x = await fetch(`${base}/admin/export.xlsx`);
  assert.equal(x.status, 200);
  assert.match(x.headers.get('content-disposition')!, /music-distribution-submissions-\d{4}-\d{2}-\d{2}\.xlsx/);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(Buffer.from(await x.arrayBuffer()) as any);
  const ws = wb.worksheets[0];
  assert.equal(ws.views[0].state, 'frozen');
  const headers = (ws.getRow(1).values as any[]).slice(1);
  for (const h of ['Submission ID', 'Artist Name', 'Email', 'Release Title', 'Track Titles', 'Distribution Stores', 'Audio Filename', 'Audio Size (MB)', 'Status']) assert.ok(headers.includes(h), h);
  const row = ws.getRow(2);
  const cell = (h: string) => row.getCell(headers.indexOf(h) + 1);
  assert.equal(cell('Submission ID').value, okBody.submissionId);
  assert.equal(cell('Status').value, 'Approved');
  assert.equal(cell('Distribution Stores').value, 'Spotify, Tidal');
  assert.equal(cell('Release Title').value, '=HYPERLINK("x")'); // stored as a plain string cell, never a formula
  assert.equal(cell('Phone').value, '+1 555 010 0100'); // no stray apostrophe
  assert.ok(cell('Created At').value instanceof Date);
  for (const v of row.values as any[]) assert.ok(!String(v).includes('[object Object]'));

  // csv
  const csv = await (await fetch(`${base}/admin/export.csv`)).text();
  assert.ok(csv.includes('Submission ID') && csv.includes(okBody.submissionId));
  assert.ok(csv.includes("'=HYPERLINK")); // CSV guards formula-looking text
  assert.ok(csv.includes(',+1 555 010 0100,')); // phone numbers untouched
});

test('persistence survives a restart of the repository', async () => {
  const again = new JsonReleaseRepository(dir);
  assert.equal(await again.count(), 1);
});
