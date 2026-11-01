import { createHmac, randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(password, salt, 64);
  return `scrypt$${salt.toString('hex')}$${key.toString('hex')}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [alg, saltHex, keyHex] = stored.split('$');
  if (alg !== 'scrypt' || !saltHex || !keyHex) return false;
  const expected = Buffer.from(keyHex, 'hex');
  const actual = await scrypt(password, Buffer.from(saltHex, 'hex'), expected.length);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/** Uses SESSION_SECRET if given, otherwise generates one once and keeps it in the data dir so sessions survive restarts. */
export async function resolveSecret(configured: string, dataDir: string): Promise<string> {
  if (configured) return configured;
  const file = path.join(dataDir, '.session-secret');
  try { return (await fs.readFile(file, 'utf8')).trim(); } catch { /* create below */ }
  const secret = randomBytes(32).toString('hex');
  await fs.mkdir(dataDir, { recursive: true });
  await fs.writeFile(file, secret, { mode: 0o600 });
  return secret;
}

const sign = (payload: string, secret: string) => createHmac('sha256', secret).update(payload).digest('base64url');

export function createToken(userId: string, ttlHours: number, secret: string): string {
  const payload = `${userId}.${Date.now() + ttlHours * 3600_000}`;
  return `${payload}.${sign(payload, secret)}`;
}

export function readToken(token: string | undefined, secret: string): string | null {
  if (!token) return null;
  const i = token.lastIndexOf('.');
  if (i < 0) return null;
  const payload = token.slice(0, i), sig = token.slice(i + 1);
  const good = Buffer.from(sign(payload, secret)), given = Buffer.from(sig);
  if (good.length !== given.length || !timingSafeEqual(good, given)) return null;
  const [userId, exp] = payload.split('.');
  return Number(exp) > Date.now() ? userId : null;
}
