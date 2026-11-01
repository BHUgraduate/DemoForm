import path from 'node:path';

const num = (v: string | undefined, d: number) => (v && Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : d);
const str = (v: string | undefined) => (v ?? '').trim();

const spreadsheetId = str(process.env.GOOGLE_SHEETS_SPREADSHEET_ID);
const emulatorUrl = str(process.env.GOOGLE_SHEETS_EMULATOR_URL); // dev/test only: point the real client at a local fake
const serviceEmail = str(process.env.GOOGLE_SHEETS_SERVICE_ACCOUNT_EMAIL);
// Env files often store the key with literal "\n" sequences.
const privateKey = str(process.env.GOOGLE_SHEETS_PRIVATE_KEY).replace(/\\n/g, '\n');

export const config = {
  port: num(process.env.PORT, 3001),
  /** DEMO: local folder. PRODUCTION: Postgres + S3/GCS (see storage/ interfaces). */
  dataDir: path.resolve(process.env.DATA_DIR || './data'),
  seedDemoData: process.env.DEMO_SEED !== 'false',
  maxAudioBytes: num(process.env.MAX_AUDIO_MB, 50) * 1024 * 1024,
  maxArtworkBytes: num(process.env.MAX_ARTWORK_MB, 10) * 1024 * 1024,
  isProd: process.env.NODE_ENV === 'production',

  auth: {
    sessionSecret: str(process.env.SESSION_SECRET), // generated + persisted in dataDir when empty
    cookieSecure: process.env.COOKIE_SECURE === 'true',
    sessionHours: num(process.env.SESSION_HOURS, 12),
    adminEmail: str(process.env.ADMIN_EMAIL) || 'admin@example.com',
    adminPassword: str(process.env.ADMIN_PASSWORD) || 'admin-demo-123',
    /** Shows the seeded demo logins on the sign-in page. Set SHOW_DEMO_LOGINS=false for anything real. */
    showDemoLogins: process.env.SHOW_DEMO_LOGINS !== 'false',
  },

  sheets: {
    spreadsheetId,
    worksheetName: str(process.env.GOOGLE_SHEETS_WORKSHEET_NAME) || 'Releases',
    pollIntervalMs: num(process.env.GOOGLE_SHEETS_POLL_INTERVAL_MS, 60000),
    serviceEmail,
    privateKey,
    emulatorUrl,
    url: str(process.env.GOOGLE_SHEET_URL) || (spreadsheetId ? `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit` : ''),
    /** Sheets sync is on only when a spreadsheet AND credentials (or the local emulator) are configured. */
    enabled: !!spreadsheetId && (!!emulatorUrl || (!!serviceEmail && !!privateKey)),
  },
};
