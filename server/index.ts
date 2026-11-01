import { config } from './config.ts';
import { createApp } from './app.ts';
import { LocalFileStorage } from './storage/fileStorage.ts';
import { JsonReleaseRepository } from './storage/releaseRepository.ts';
import { JsonUserRepository } from './storage/userRepository.ts';
import { seedDemoData, seedUsers } from './seed.ts';
import { resolveSecret } from './auth/security.ts';
import { GoogleSheetsGateway } from './sheets/gateway.ts';
import { SheetsSync, startPoller } from './sheets/sync.ts';

const releases = new JsonReleaseRepository(config.dataDir);
const files = new LocalFileStorage(config.dataDir);
const users = new JsonUserRepository(config.dataDir);

const secret = await resolveSecret(config.auth.sessionSecret, config.dataDir);
await seedUsers(users);
if (config.seedDemoData) await seedDemoData(releases);

// Google Sheets is optional: without credentials the app runs on the database alone.
const gateway = config.sheets.enabled
  ? new GoogleSheetsGateway({
      spreadsheetId: config.sheets.spreadsheetId, worksheetName: config.sheets.worksheetName,
      serviceEmail: config.sheets.serviceEmail, privateKey: config.sheets.privateKey, emulatorUrl: config.sheets.emulatorUrl,
    })
  : null;
const sync = new SheetsSync(releases, gateway);

createApp({ releases, files, users, sync, secret: () => secret }).listen(config.port, () => {
  console.log(`Soundlane demo API listening on http://localhost:${config.port}  (data: ${config.dataDir})`);
  startPoller(sync, config.sheets.pollIntervalMs);
});
