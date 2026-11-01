import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startHarness, type Harness } from './helpers/harness.ts';

let h: Harness, artist: string, other: string, admin: string;
const fake = () => h.fake!;
const adminGet = async (id: string) => (await h.call(admin)(`/admin/releases/${id}`)).body.release;
const adminRow = async (id: string) => (await h.call(admin)('/admin/releases')).body.releases.find((r: any) => r.id === id);
const myRow = async (cookie: string, id: string) => (await h.call(cookie)('/my/releases')).body.releases.find((r: any) => r.id === id);
const mutating = (calls: string[]) => calls.filter((c) => c !== 'GET values' && c !== 'GET spreadsheet');

before(async () => {
  h = await startHarness({ sheets: true });
  artist = await h.login('artist@example.com');
  other = await h.login('other@example.com');
  admin = await h.login('admin@example.com');
});
after(() => h.stop());

let id = '';
let row = 0;

test('1. artist submits → database, admin dashboard and Google Sheet all have it, status Under Review', async () => {
  const res = await h.submit(artist, 'Test Song');
  assert.equal(res.status, 201);
  assert.equal(res.body.status, 'Under Review');
  id = res.body.submissionId;

  // database (via admin API) — owned by the artist, sheet row remembered
  const rec = await adminGet(id);
  assert.equal(rec.status, 'Under Review');
  assert.equal(rec.googleSheetSyncStatus, 'synced');
  assert.ok(rec.googleSheetRow >= 2);
  row = rec.googleSheetRow;

  // admin dashboard list
  assert.equal((await adminRow(id)).release.title, 'Test Song');

  // the real Google Sheet (emulated) — header + one data row in the centrally-defined columns
  const grid = fake().tab().grid;
  assert.equal(grid[0][0], 'Submission ID');
  assert.equal(grid[0][14], 'Status');
  assert.equal(fake().rowOf(id), row);
  assert.equal(fake().cell(row, 'A'), id);
  assert.equal(fake().cell(row, 'B'), rec.userId);
  assert.equal(fake().cell(row, 'C'), 'Tester');
  assert.equal(fake().cell(row, 'D'), 'artist@example.com');
  assert.equal(fake().cell(row, 'F'), 'Test Song');
  assert.equal(fake().cell(row, 'K'), '1');
  assert.equal(fake().cell(row, 'L'), 'Spotify, Tidal');
  assert.equal(fake().cell(row, 'M'), 'song.wav');
  assert.equal(fake().cell(row, 'O'), 'Under Review');
  assert.equal(fake().tab().conditionalFormats, 6); // colour-coded statuses
  assert.equal(fake().tab().validations.length, 1); // Status dropdown
  assert.equal(fake().tab().frozen, 1);

  // artist's dashboard shows it
  assert.equal((await myRow(artist, id)).status, 'Under Review');
});

test('2. admin edits the SHEET: Under Review → Approved; poll → DB, admin dashboard, user dashboard', async () => {
  fake().setCell(row, 'O', 'Approved');
  await h.sync.poll();
  assert.equal((await adminGet(id)).status, 'Approved');
  assert.equal((await adminRow(id)).status, 'Approved');
  assert.equal((await myRow(artist, id)).status, 'Approved');
  assert.ok(h.logs.some((l) => l.includes(`${id} status changed: Under Review → Approved`)));
  assert.ok(h.logs.some((l) => l.includes('Database updated')));
});

test('3. idempotent: further polls change nothing and write nothing to the sheet', async () => {
  const before = await adminGet(id);
  fake().calls.length = 0;
  await h.sync.poll(); await h.sync.poll();
  const after = await adminGet(id);
  assert.equal(after.updatedAt, before.updatedAt);
  assert.deepEqual(mutating(fake().calls), []);
  assert.equal(fake().dataRows().length, 1);
  assert.equal(((await h.call(admin)('/admin/releases')).body.releases as any[]).filter((r) => r.id === id).length, 1);
});

test('4. Approved → Rejected, then Rejected → Needs Changes with an Admin Note shown to the artist', async () => {
  fake().setCell(row, 'O', 'Rejected');
  await h.sync.poll();
  assert.equal((await adminGet(id)).status, 'Rejected');
  assert.equal((await myRow(artist, id)).status, 'Rejected');

  fake().setCell(row, 'O', 'Needs Changes');
  fake().setCell(row, 'P', 'Please upload a higher-resolution cover image.');
  await h.sync.poll();
  const mine = await myRow(artist, id);
  assert.equal(mine.status, 'Needs Changes');
  assert.equal(mine.adminNote, 'Please upload a higher-resolution cover image.');
  assert.equal((await adminRow(id)).adminNote, 'Please upload a higher-resolution cover image.');
});

test('5. admin DASHBOARD edit → pushed to the sheet; the next poll does NOT loop or revert', async () => {
  const res = await h.call(admin)(`/admin/releases/${id}/status`, { method: 'PATCH', json: { status: 'Approved', adminNote: 'Looks great now.' } });
  assert.equal(res.status, 200);
  assert.equal(fake().cell(row, 'O'), 'Approved');
  assert.equal(fake().cell(row, 'P'), 'Looks great now.');
  assert.equal((await myRow(artist, id)).status, 'Approved');

  fake().calls.length = 0;
  await h.sync.poll();
  assert.deepEqual(mutating(fake().calls), []); // nothing written: DB == Sheet
  assert.equal((await adminGet(id)).status, 'Approved');
  assert.equal(fake().cell(row, 'O'), 'Approved');
});

test('6. case / spacing in the sheet is tolerated; invalid values are ignored and repaired', async () => {
  fake().setCell(row, 'O', '  rejected ');
  await h.sync.poll();
  assert.equal((await adminGet(id)).status, 'Rejected');

  fake().setCell(row, 'O', 'Banana');
  await h.sync.poll();
  assert.equal((await adminGet(id)).status, 'Rejected'); // never applied
  assert.equal(fake().cell(row, 'O'), 'Rejected'); // cell repaired from the database
  assert.ok(h.logs.some((l) => l.includes('invalid status "Banana"')));
});

test('7. admin sorts/inserts rows in the sheet: still matched by Submission ID, never by row number', async () => {
  fake().insertRow(2, ['REL-9999-00001', 'x', 'Unknown', 'u@example.com', '', 'Ghost', '', '', '', '', '', '', '', '', 'Approved']);
  await h.sync.poll();
  const rec = await adminGet(id);
  assert.equal(rec.googleSheetRow, fake().rowOf(id)); // row cache refreshed
  assert.equal(rec.status, 'Rejected');
  assert.ok(h.logs.some((l) => l.includes('REL-9999-00001 is in the sheet but not in the database')));
  assert.equal((await h.call(admin)('/admin/releases')).body.releases.some((r: any) => r.release.title === 'Ghost'), false);

  // write-back goes to the right row even though the stored row number was stale
  await h.call(admin)(`/admin/releases/${id}/status`, { method: 'PATCH', json: { status: 'Processing' } });
  assert.equal(fake().cell(fake().rowOf(id)!, 'O'), 'Processing');
  assert.equal(fake().cell(2, 'O'), 'Approved'); // the ghost row untouched
  row = fake().rowOf(id)!;
});

test('8. both sides changed → the sheet wins', async () => {
  await h.releases.update(id, (r) => ({ ...r, status: 'Completed', updatedAt: new Date().toISOString(), googleSheetSyncStatus: 'pending' })); // DB side
  fake().setCell(row, 'O', 'Needs Changes'); // sheet side
  await h.sync.poll();
  assert.equal((await adminGet(id)).status, 'Needs Changes');
  assert.ok(h.logs.some((l) => l.includes('changed in BOTH places — sheet wins')));
});

test('9. admin deletes the sheet row → re-created exactly once', async () => {
  fake().deleteRow(fake().rowOf(id)!);
  await h.sync.poll(); await h.sync.poll();
  assert.equal(fake().tab().grid.filter((r) => r[0] === id).length, 1);
  assert.equal(fake().cell(fake().rowOf(id)!, 'O'), 'Needs Changes');
});

test('10. Google outage: submission is still stored (sync failed), poll never throws, recovery syncs exactly one row', async () => {
  fake().failing = true;
  const res = await h.submit(artist, 'Outage Song');
  assert.equal(res.status, 201); // stored even though Google is down
  const oid = res.body.submissionId;
  const rec = await adminGet(oid);
  assert.equal(rec.status, 'Under Review');
  assert.equal(rec.googleSheetSyncStatus, 'failed');
  assert.equal(rec.googleSheetRow, null);
  await h.sync.poll(); // must not throw
  assert.equal(h.sync.state.lastPollOk, false);
  assert.equal((await myRow(artist, oid)).status, 'Under Review'); // user dashboard unaffected

  fake().failing = false;
  await h.sync.poll();
  assert.equal(h.sync.state.lastPollOk, true);
  assert.equal((await adminGet(oid)).googleSheetSyncStatus, 'synced');
  assert.equal(fake().tab().grid.filter((r) => r[0] === oid).length, 1);

  fake().setCell(fake().rowOf(oid)!, 'O', 'Approved');
  await h.sync.poll();
  assert.equal((await myRow(artist, oid)).status, 'Approved');
});

test('11. privacy: artists only see their own releases; sheet data is never exposed over the API', async () => {
  assert.equal((await h.call(other)('/my/releases')).body.releases.length, 0);
  assert.equal((await h.call(other)(`/my/releases/${id}`)).status, 404);
  assert.equal((await h.call(artist)('/admin/sheets')).status, 403);
  const info = (await h.call(admin)('/admin/sheets')).body.sheets;
  assert.equal(info.enabled, true);
  assert.ok(!JSON.stringify(info).includes('PRIVATE KEY'));
  assert.equal((await h.call(null)('/admin/sheets/sync', { method: 'POST' })).status, 401);
});
