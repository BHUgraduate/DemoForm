import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ExcelJS from 'exceljs';
import { startHarness, type Harness } from './helpers/harness.ts';

let h: Harness, artist: string, admin: string;
before(async () => { h = await startHarness({ sheets: false }); artist = await h.login('artist@example.com'); admin = await h.login('admin@example.com'); });
after(() => h.stop());

test('auth: sign-in required; wrong password rejected; roles enforced', async () => {
  assert.equal((await h.call(null)('/releases', { method: 'POST', json: {} })).status, 401);
  assert.equal((await h.call(null)('/my/releases')).status, 401);
  assert.equal((await h.call(null)('/admin/releases')).status, 401);
  assert.equal((await h.call(artist)('/admin/releases')).status, 403);
  assert.equal((await h.call(admin)('/admin/releases')).status, 200);
  const bad = await fetch(`${h.base}/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'artist@example.com', password: 'nope' }) });
  assert.equal(bad.status, 401);
  assert.equal((await h.call('sl_session=forged.123.abc')('/my/releases')).status, 401);
  const me = await h.call(artist)('/auth/me');
  assert.equal(me.body.user.email, 'artist@example.com');
  assert.equal(me.body.user.passwordHash, undefined);
  const reg = await h.call(null)('/auth/register', { method: 'POST', json: { name: 'New', email: 'artist@example.com', password: 'longenough1' } });
  assert.equal(reg.status, 409);
});

test('rejects wrong file types and spoofed content', async () => {
  fs.writeFileSync(path.join(h.dir, 'x.pdf'), 'hello');
  assert.equal((await h.upload(artist, 'audio', path.join(h.dir, 'x.pdf'), 'a.pdf')).status, 415);
  assert.equal((await h.upload(artist, 'audio', path.join(h.dir, 'x.pdf'), 'fake.mp3')).status, 415);
  assert.equal((await h.upload(artist, 'artwork', 'demo-assets/sample-track.wav', 'cover.png')).status, 415);
});

test('submit → validated, owned by the session user, initial status Under Review, stored, exported', async () => {
  const bad = await h.call(artist)('/releases', { method: 'POST', json: h.payload('x', 'y', { artist: { ...h.payload('', '').artist, email: 'nope' }, rights: { ownsRights: false, infoAccurate: true, authorizeProcessing: true } }) });
  assert.equal(bad.status, 400);
  assert.ok(bad.body.fieldErrors['artist.email'] && bad.body.fieldErrors['rights.ownsRights']);

  const ok = await h.submit(artist, '=HYPERLINK("x")');
  assert.equal(ok.status, 201);
  assert.equal(ok.body.status, 'Under Review');
  assert.match(ok.body.submissionId, new RegExp(`^REL-${new Date().getFullYear()}-00001$`));
  assert.equal((await h.submit(artist, '=HYPERLINK("x")')).status, 409); // duplicate

  const rec = (await h.call(admin)(`/admin/releases/${ok.body.submissionId}`)).body.release;
  assert.equal(rec.userId, (await h.call(artist)('/auth/me')).body.user.id);
  assert.equal(rec.artist.legalName, 'Test Artist');
  assert.equal(rec.googleSheetSyncStatus, 'disabled'); // no sheet configured → database only

  const x = await h.call(admin)('/admin/export.xlsx');
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(x.bytes as any);
  const ws = wb.worksheets[0];
  const headers = (ws.getRow(1).values as any[]).slice(1);
  for (const col of ['Submission ID', 'Email', 'Release Title', 'Status', 'Admin Note']) assert.ok(headers.includes(col), col);
  assert.equal(ws.getRow(2).getCell(headers.indexOf('Release Title') + 1).value, '=HYPERLINK("x")');
  assert.equal(ws.views[0].state, 'frozen');
  assert.equal((await h.call(null)('/admin/export.xlsx')).status, 401);
});
