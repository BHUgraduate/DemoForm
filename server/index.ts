import { config } from './config.ts';
import { createApp } from './app.ts';
import { LocalFileStorage } from './storage/fileStorage.ts';
import { JsonReleaseRepository } from './storage/releaseRepository.ts';
import { seedDemoData } from './seed.ts';

const releases = new JsonReleaseRepository(config.dataDir);
const files = new LocalFileStorage(config.dataDir);

if (config.seedDemoData) await seedDemoData(releases);

createApp({ releases, files }).listen(config.port, () => {
  console.log(`Soundlane demo API listening on http://localhost:${config.port}  (data: ${config.dataDir})`);
});
