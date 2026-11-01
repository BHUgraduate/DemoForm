// Full round trip in a real browser:  artist submits → DB → Admin dashboard → Google Sheet (emulated) →
// "admin" edits the sheet → backend poller → DB → artist dashboard updates by itself.
//   npx tsx scripts/fake-sheets.ts &   (port 4010)
//   GOOGLE_SHEETS_EMULATOR_URL=http://127.0.0.1:4010 GOOGLE_SHEETS_SPREADSHEET_ID=demo-sheet GOOGLE_SHEETS_POLL_INTERVAL_MS=2000 \
//     GOOGLE_SHEET_URL=http://127.0.0.1:4010/__control/dump PORT=3201 npm start &
//   NODE_PATH=$(npm root -g) node scripts/e2e-sheets.cjs
const { chromium, devices } = require('playwright');
const path = require('path');
const BASE = process.env.BASE || 'http://localhost:3201';
const SHEET = process.env.SHEET || 'http://127.0.0.1:4010';
const OUT = process.env.OUT || '/tmp/shots2';
const assets = (f) => path.resolve(__dirname, '../demo-assets', f);
require('fs').mkdirSync(OUT, { recursive: true });

const sheetDump = async () => (await (await fetch(`${SHEET}/__control/dump`)).json()).tabs.find((t) => t.title === 'Releases').rows;
const sheetRow = async (id) => (await sheetDump()).find((r) => r[0] === id);
const sheetSet = async (id, column, value) => {
  const r = await fetch(`${SHEET}/__control/set`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id, column, value }) });
  if (!r.ok) throw new Error('sheet edit failed');
};

(async () => {
  const browser = await chromium.launch();
  const problems = [];
  const watch = (page, tag) => {
    page.on('console', (m) => m.type() === 'error' && problems.push(`${tag} console: ${m.text()}`));
    page.on('pageerror', (e) => problems.push(`${tag} pageerror: ${e.message}`));
    page.on('response', (r) => r.status() >= 500 && problems.push(`${tag} http ${r.status()} ${r.url()}`));
  };

  /* ── ARTIST: sign in and submit through the real wizard ── */
  const artistCtx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await artistCtx.newPage(); watch(page, 'artist');
  const next = () => page.getByRole('button', { name: /Continue/ }).click();
  await page.goto(BASE);
  await page.getByRole('link', { name: 'Distribute Your Music' }).click();
  await page.getByText('Demo accounts').waitFor();
  await page.screenshot({ path: `${OUT}/01-login.png` });
  await page.getByRole('button', { name: /Fill artist/ }).click();
  await page.getByRole('button', { name: 'Sign in' }).last().click();
  await page.getByText('Create your artist profile').waitFor();

  await page.getByLabel(/^Artist \/ legal name/).fill('Aarav Mehta');
  await page.getByLabel(/^Artist display name/).fill('Aarav Mehta');
  await page.getByLabel(/^Phone number/).fill('+91 98765 43210');
  await page.getByLabel(/^Country/).fill('India');
  await page.getByLabel(/^Artist type/).selectOption('Solo Artist');
  await page.getByLabel(/^Artist \/ legal name/).fill(''); await next();
  if (!(await page.getByText('Legal name is required').isVisible())) throw new Error('validation missing');
  await page.getByLabel(/^Artist \/ legal name/).fill('Aarav Mehta'); await next();

  await page.getByRole('radio', { name: 'Single' }).check();
  await page.getByLabel(/^Release title/).fill('Raasta');
  await page.getByLabel(/^Primary artist/).first().fill('Aarav Mehta');
  await page.getByLabel(/^Release date/).fill('2026-12-12');
  await page.getByLabel(/^Genre/).selectOption('Pop');
  await page.getByLabel(/^Language/).selectOption('Hindi');
  const yn = (g, v) => page.getByRole('radiogroup', { name: new RegExp(g) }).getByRole('radio', { name: v }).check();
  await yn('Explicit content', 'No'); await yn('Original release', 'Yes'); await yn('Previously released', 'No');
  await page.getByLabel(/^Songwriter/).fill('Aarav Mehta'); await page.getByLabel(/^Composer/).fill('Aarav Mehta');
  await page.getByLabel(/^Copyright owner/).fill('Aarav Mehta'); await next();

  await page.getByLabel(/^Track title/).fill('Raasta');
  await page.getByLabel('Songwriter').fill('Aarav Mehta'); await page.getByLabel('Producer').fill('Neel Kapoor');
  await next();
  await page.locator('input[type=file]').setInputFiles(assets('sample-track.wav')); await page.getByText('Uploaded to the server').waitFor(); await next();
  await page.locator('input[type=file]').setInputFiles(assets('sample-cover.png')); await page.getByText('Uploaded to the server').waitFor(); await next();
  await page.getByText('Select all stores').click(); await next();
  for (const t of [/own or control the rights/, /information provided is accurate/, /authorize this platform/]) await page.getByLabel(t).check();
  await next();
  await page.getByRole('button', { name: 'Submit Release' }).click();
  await page.getByText('Release Submitted').waitFor();
  const id = (await page.getByTestId('submission-id').textContent()).trim();
  console.log('1. submitted:', id);
  if (!(await page.getByText('Under Review').first().isVisible())) throw new Error('success page missing status');
  await page.screenshot({ path: `${OUT}/02-success.png` });

  /* ── Google Sheet has the row, Under Review ── */
  const row = await sheetRow(id);
  if (!row) throw new Error('row not in sheet');
  console.log('2. sheet row:', JSON.stringify([row[0], row[2], row[3], row[5], row[14]]));
  if (row[14] !== 'Under Review' || row[5] !== 'Raasta') throw new Error('sheet row wrong');

  /* ── ADMIN dashboard shows it ── */
  const adminCtx = await browser.newContext({ viewport: { width: 1360, height: 900 } });
  const admin = await adminCtx.newPage(); watch(admin, 'admin');
  await admin.goto(BASE + '/admin'); // redirected to login
  await admin.getByRole('button', { name: /Fill admin/ }).click();
  await admin.getByRole('button', { name: 'Sign in' }).last().click();
  await admin.getByText(id).first().waitFor();
  const linkHref = await admin.getByRole('link', { name: /Open Google Sheet/ }).getAttribute('href');
  console.log('3. admin dashboard lists it; "Open Google Sheet" →', linkHref);
  await admin.screenshot({ path: `${OUT}/03-admin-under-review.png` });
  const adminStatus = () => admin.locator('tr', { hasText: id }).locator('.badge').textContent();

  /* ── user dashboard, then the admin edits the SHEET; the page is never reloaded ── */
  await page.getByRole('link', { name: 'View Submission' }).click();
  const status = page.getByTestId(`status-${id}`);
  await status.getByText('Under Review').waitFor();
  await page.screenshot({ path: `${OUT}/04-user-under-review.png` });

  const roundTrip = async (label, value, note) => {
    const t0 = Date.now();
    await sheetSet(id, 'O', value);
    if (note !== undefined) await sheetSet(id, 'P', note);
    await status.getByText(value).waitFor({ timeout: 30000 });
    console.log(`   ${label}: sheet → "${value}" appeared on the artist dashboard after ${((Date.now() - t0) / 1000).toFixed(1)}s (no reload)`);
  };
  await roundTrip('Under Review → Approved', 'Approved');
  await page.screenshot({ path: `${OUT}/05-user-approved.png` });
  await admin.reload(); await admin.getByText(id).first().waitFor();
  if ((await adminStatus()).trim() !== 'Approved') throw new Error('admin dashboard did not show Approved');
  console.log('4. admin dashboard shows Approved');
  await admin.screenshot({ path: `${OUT}/06-admin-approved.png` });

  await roundTrip('Approved → Rejected', 'Rejected');
  await page.screenshot({ path: `${OUT}/07-user-rejected.png` });
  await roundTrip('Rejected → Needs Changes', 'Needs Changes', 'Please upload a higher-resolution cover image.');
  await page.getByText('Please upload a higher-resolution cover image.').waitFor();
  await page.screenshot({ path: `${OUT}/08-user-needs-changes.png` });
  console.log('5. admin note visible on the artist dashboard');

  /* ── reverse direction: admin changes status in the WEBSITE → sheet + artist ── */
  await admin.goto(`${BASE}/admin/releases/${id}`);
  await admin.locator('#status').selectOption('Approved');
  await admin.locator('#note').fill('Cover looks great now.');
  await admin.getByRole('button', { name: 'Save status' }).click();
  await admin.getByText(/Google Sheet updated/).waitFor();
  const after = await sheetRow(id);
  if (after[14] !== 'Approved' || after[15] !== 'Cover looks great now.') throw new Error('admin dashboard edit did not reach the sheet: ' + JSON.stringify(after));
  await status.getByText('Approved').waitFor({ timeout: 30000 });
  console.log('6. admin-dashboard edit reached the sheet and the artist dashboard');
  await admin.screenshot({ path: `${OUT}/09-admin-detail.png` });

  await new Promise((r) => setTimeout(r, 5000)); // several polls later: no loop, no revert
  const settled = await sheetRow(id);
  if (settled[14] !== 'Approved') throw new Error('status reverted by a sync loop');
  console.log('7. stable after further polls (no sync loop); rows with this ID in sheet:', (await sheetDump()).filter((r) => r[0] === id).length);

  /* ── phone-sized artist dashboard ── */
  const mCtx = await browser.newContext({ ...devices['iPhone 14'] });
  const m = await mCtx.newPage(); watch(m, 'iphone');
  await m.goto(BASE + '/login'); await m.getByRole('button', { name: /Fill artist/ }).click(); await m.getByRole('button', { name: 'Sign in' }).last().click();
  await m.getByText('My Releases').first().waitFor(); await m.getByText(id).waitFor();
  await m.screenshot({ path: `${OUT}/10-iphone-dashboard.png` });
  if (await m.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)) problems.push('iphone: horizontal overflow');

  await browser.close();
  console.log('problems:', problems);
  process.exit(problems.length ? 1 : 0);
})().catch((e) => { console.error('E2E FAILED:', e.message); process.exit(1); });
