// Drives the complete client demo in a real browser. Usage: BASE=http://localhost:3201 node scripts/e2e-demo.cjs
const { chromium, devices } = require('playwright');
const path = require('path');
const BASE = process.env.BASE || 'http://localhost:3201';
const OUT = process.env.OUT || '/tmp/shots';
const assets = (f) => path.resolve(__dirname, '../demo-assets', f);
require('fs').mkdirSync(OUT, { recursive: true });

async function run(label, ctxOpts, title) {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ ...ctxOpts, acceptDownloads: true });
  const page = await ctx.newPage();
  const problems = [];
  page.on('console', (m) => m.type() === 'error' && problems.push('console: ' + m.text()));
  page.on('pageerror', (e) => problems.push('pageerror: ' + e.message));
  page.on('response', (r) => r.status() >= 500 && problems.push('http ' + r.status() + ' ' + r.url()));
  const shot = (n) => page.screenshot({ path: `${OUT}/${label}-${n}.png`, fullPage: false });
  const next = () => page.getByRole('button', { name: /Continue/ }).click();

  await page.goto(BASE); await shot('01-landing');
  await page.getByRole('link', { name: 'Distribute Your Music' }).click();

  // validation: empty step 1
  await next();
  if (!(await page.getByText('Legal name is required').isVisible())) throw new Error('inline validation missing');
  await page.getByLabel(/^Email/).fill('not-an-email');
  await page.getByLabel('Artist / legal name').fill('Maya Demo');
  await page.getByLabel('Artist display name').fill('Maya D.');
  await page.getByLabel('Phone number').fill('+1 555 010 0123');
  await page.getByLabel('Country').fill('United States');
  await page.getByLabel('Artist type').selectOption('Solo Artist');
  await next();
  if (!(await page.getByText('Enter a valid email address').isVisible())) throw new Error('email validation missing');
  await shot('02-artist-errors');
  await page.getByLabel(/^Email/).fill(`maya.${label}@example.com`);
  await next();

  // release
  await page.getByRole('radio', { name: 'Single' }).check();
  await page.getByLabel('Release title').fill(title);
  await page.getByLabel('Primary artist').first().fill('Maya D.');
  await page.getByLabel('Release date').fill('2026-12-12');
  await page.getByLabel(/^Genre/).selectOption('Pop');
  await page.getByLabel(/^Language/).selectOption('English');
  const yn = async (group, v) => page.getByRole('radiogroup', { name: new RegExp(group) }).getByRole('radio', { name: v }).check();
  await yn('Explicit content', 'No'); await yn('Original release', 'Yes'); await yn('Previously released', 'Yes');
  await page.getByLabel('Previous release date').fill('2026-05-01');
  await page.getByLabel('Songwriter').fill('Maya Demo'); await page.getByLabel('Composer').fill('Maya Demo');
  await page.getByLabel('Copyright owner').fill('Maya Demo');
  await shot('03-release'); await next();

  // tracks (two tracks)
  await page.getByLabel('Track title').fill('Glass Hours');
  await page.getByLabel(/^Language/).selectOption('English');
  await page.getByRole('radiogroup', { name: /Explicit/ }).getByRole('radio', { name: 'No' }).check();
  await page.getByRole('button', { name: '+ Add another track' }).click();
  await page.getByLabel('Track title').nth(1).fill('Glass Hours (Acoustic)');
  await page.getByLabel('Version').nth(1).selectOption('Acoustic');
  await page.getByLabel('Track number').nth(1).fill('1'); // duplicate number -> error
  await next();
  if (!(await page.getByText('Track numbers must be unique').first().isVisible())) throw new Error('dup track number not caught');
  await page.getByLabel('Track number').nth(1).fill('2');
  await shot('04-tracks'); await next();

  // audio: bad type then good
  await page.locator('input[type=file]').setInputFiles(assets('sample-cover.png'));
  if (!(await page.getByText(/isn't supported/).isVisible())) throw new Error('bad audio type not rejected');
  await page.locator('input[type=file]').setInputFiles(assets('sample-track.wav'));
  await page.getByText('Uploaded to the server').waitFor();
  await shot('05-audio'); await next();

  // artwork
  await page.locator('input[type=file]').setInputFiles(assets('sample-track.wav'));
  if (!(await page.getByText(/isn't supported/).isVisible())) throw new Error('bad art type not rejected');
  await page.locator('input[type=file]').setInputFiles(assets('sample-cover.png'));
  await page.getByText('Uploaded to the server').waitFor();
  await shot('06-artwork'); await next();

  // stores
  await next(); // none selected -> error
  if (!(await page.getByText('Select at least one store').isVisible())) throw new Error('store validation missing');
  await page.getByText('Select all stores').click();
  await shot('07-stores'); await next();

  // rights
  await next();
  if (!(await page.getByText('You must confirm you control the rights').isVisible())) throw new Error('rights validation missing');
  for (const t of [/own or control the rights/, /information provided is accurate/, /authorize this platform/]) await page.getByLabel(t).check();
  await next();

  // review + edit button + submit
  await shot('08-review');
  await page.getByRole('button', { name: 'Edit Release' }).click();
  await page.getByLabel('Release title').waitFor();
  for (let i = 0; i < 6; i++) await next(); // walk back through already-valid steps
  await page.getByRole('button', { name: 'Submit Release' }).click();
  await page.getByText('Release Submitted').waitFor();
  const id = (await page.getByTestId('submission-id').textContent()).trim();
  console.log(`[${label}] submission id:`, id);
  await shot('09-success');

  // admin
  await page.getByRole('link', { name: 'View Submission' }).click();
  await page.getByRole('heading', { name: title }).waitFor();
  await shot('10-admin-detail');
  await page.locator('#status').selectOption('Under Review');
  await page.getByText('Status updated to “Under Review”').waitFor();

  await page.goto(BASE + '/admin');
  await page.getByText(id).first().waitFor();
  await page.getByLabel('Search submissions').fill(`maya.${label}`);
  await page.waitForTimeout(500);
  const rows = await page.locator('tbody tr').count();
  if (rows !== 1) throw new Error('search expected 1 row, got ' + rows);
  await page.getByLabel('Search submissions').fill('');
  await page.getByLabel('Filter by status').selectOption('Under Review');
  await page.waitForTimeout(400);
  await shot('11-admin-dashboard');

  await page.getByLabel('Filter by status').selectOption('');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Export to Excel' }).click()]);
  const file = `${OUT}/${label}-${dl.suggestedFilename()}`;
  await dl.saveAs(file);
  console.log(`[${label}] downloaded`, dl.suggestedFilename());

  const horiz = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  if (horiz) problems.push('horizontal overflow on admin page');
  await browser.close();
  return { problems, file };
}

(async () => {
  const d = await run('desktop', { viewport: { width: 1360, height: 860 } }, 'Glass Hours');
  const m = await run('iphone', { ...devices['iPhone 14'] }, 'Glass Hours Mobile');
  console.log('problems:', [...d.problems, ...m.problems]);
  console.log('files:', d.file, m.file);
  process.exit(d.problems.length + m.problems.length ? 1 : 0);
})().catch((e) => { console.error('E2E FAILED:', e.message); process.exit(1); });
