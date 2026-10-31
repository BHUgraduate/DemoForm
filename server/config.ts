import path from 'node:path';

const num = (v: string | undefined, d: number) => (v && Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : d);

export const config = {
  port: num(process.env.PORT, 3001),
  /** DEMO: local folder. PRODUCTION: Postgres + S3/GCS (see storage/ interfaces). */
  dataDir: path.resolve(process.env.DATA_DIR || './data'),
  seedDemoData: process.env.DEMO_SEED !== 'false',
  maxAudioBytes: num(process.env.MAX_AUDIO_MB, 50) * 1024 * 1024,
  maxArtworkBytes: num(process.env.MAX_ARTWORK_MB, 10) * 1024 * 1024,
  isProd: process.env.NODE_ENV === 'production',
};
