import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

export interface UserRecord {
  id: string;
  name: string;
  email: string; // stored lower-case
  passwordHash: string;
  role: 'artist' | 'admin';
  createdAt: string;
}

/** DEMO: JSON file. PRODUCTION: a users table with a managed identity provider. */
export class JsonUserRepository {
  private file: string;
  private cache: UserRecord[] | null = null;
  private queue: Promise<unknown> = Promise.resolve();
  constructor(baseDir: string) { this.file = path.join(baseDir, 'users.json'); }

  private async load() {
    if (this.cache) return this.cache;
    try { this.cache = JSON.parse(await fs.readFile(this.file, 'utf8')) as UserRecord[]; }
    catch (e: any) { if (e?.code !== 'ENOENT') throw e; this.cache = []; }
    return this.cache;
  }

  async findByEmail(email: string) { const e = email.trim().toLowerCase(); return (await this.load()).find((u) => u.email === e) ?? null; }
  async findById(id: string) { return (await this.load()).find((u) => u.id === id) ?? null; }

  /** Returns null when the email is already registered. */
  create(input: Omit<UserRecord, 'id' | 'createdAt' | 'email'> & { email: string }): Promise<UserRecord | null> {
    const run = this.queue.then(async () => {
      const rows = await this.load();
      const email = input.email.trim().toLowerCase();
      if (rows.some((u) => u.email === email)) return null;
      const user: UserRecord = { ...input, email, id: randomUUID(), createdAt: new Date().toISOString() };
      const next = [...rows, user];
      await fs.mkdir(path.dirname(this.file), { recursive: true });
      await fs.writeFile(this.file + '.tmp', JSON.stringify(next, null, 2));
      await fs.rename(this.file + '.tmp', this.file);
      this.cache = next;
      return user;
    });
    this.queue = run.catch(() => undefined);
    return run;
  }
}
