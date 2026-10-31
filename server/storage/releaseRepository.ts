import fs from 'node:fs/promises';
import path from 'node:path';
import type { ReleaseRecord, Status, Stats } from '../../shared/schema.ts';

export interface ReleaseFilters {
  search?: string;
  status?: string;
  releaseType?: string;
  genre?: string;
  sort?: 'asc' | 'desc';
}

/**
 * Persistence abstraction. The demo implements it with one JSON file.
 * PRODUCTION: implement this interface with PostgreSQL / Supabase / Firestore —
 * routes, export and validation do not change.
 */
export interface ReleaseRepository {
  create(build: (id: string) => ReleaseRecord): Promise<ReleaseRecord>;
  get(id: string): Promise<ReleaseRecord | null>;
  list(filters?: ReleaseFilters): Promise<ReleaseRecord[]>;
  updateStatus(id: string, status: Status): Promise<ReleaseRecord | null>;
  findDuplicate(email: string, title: string, releaseType: string): Promise<ReleaseRecord | null>;
  stats(): Promise<Stats>;
  count(): Promise<number>;
}

export function applyFilters(all: ReleaseRecord[], f: ReleaseFilters = {}): ReleaseRecord[] {
  const q = (f.search || '').trim().toLowerCase();
  const out = all.filter((r) => {
    if (f.status && r.status !== f.status) return false;
    if (f.releaseType && r.release.releaseType !== f.releaseType) return false;
    if (f.genre && r.release.genre !== f.genre) return false;
    if (q) {
      const hay = [r.artist.legalName, r.artist.displayName, r.release.primaryArtist, r.artist.email, r.release.title, r.id].join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
  out.sort((a, b) => (f.sort === 'asc' ? 1 : -1) * (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0));
  return out;
}

export class JsonReleaseRepository implements ReleaseRepository {
  private file: string;
  private cache: ReleaseRecord[] | null = null;
  /** Serialises writes so concurrent submissions can't clobber each other or reuse an ID. */
  private queue: Promise<unknown> = Promise.resolve();

  constructor(baseDir: string) {
    this.file = path.join(baseDir, 'releases.json');
  }

  private async load(): Promise<ReleaseRecord[]> {
    if (this.cache) return this.cache;
    try {
      this.cache = JSON.parse(await fs.readFile(this.file, 'utf8')) as ReleaseRecord[];
    } catch (e: any) {
      if (e?.code !== 'ENOENT') throw e;
      this.cache = [];
    }
    return this.cache;
  }

  private async persist(rows: ReleaseRecord[]) {
    await fs.mkdir(path.dirname(this.file), { recursive: true });
    const tmp = this.file + '.tmp';
    await fs.writeFile(tmp, JSON.stringify(rows, null, 2));
    await fs.rename(tmp, this.file); // atomic replace: a crash never leaves a half-written file
  }

  private exclusive<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.queue.then(fn, fn);
    this.queue = run.catch(() => undefined);
    return run;
  }

  create(build: (id: string) => ReleaseRecord) {
    return this.exclusive(async () => {
      const rows = await this.load();
      const year = new Date().getFullYear();
      const used = rows
        .map((r) => /^REL-(\d{4})-(\d+)$/.exec(r.id))
        .filter((m): m is RegExpExecArray => !!m && Number(m[1]) === year)
        .map((m) => Number(m[2]));
      const id = `REL-${year}-${String((used.length ? Math.max(...used) : 0) + 1).padStart(5, '0')}`;
      const record = build(id);
      const next = [...rows, record];
      await this.persist(next);
      this.cache = next;
      return record;
    });
  }

  async get(id: string) {
    return (await this.load()).find((r) => r.id === id) ?? null;
  }

  async list(filters?: ReleaseFilters) {
    return applyFilters(await this.load(), filters);
  }

  updateStatus(id: string, status: Status) {
    return this.exclusive(async () => {
      const rows = await this.load();
      const idx = rows.findIndex((r) => r.id === id);
      if (idx < 0) return null;
      const updated = { ...rows[idx], status, updatedAt: new Date().toISOString() };
      const next = rows.slice();
      next[idx] = updated;
      await this.persist(next);
      this.cache = next;
      return updated;
    });
  }

  async findDuplicate(email: string, title: string, releaseType: string) {
    const e = email.toLowerCase(), t = title.toLowerCase();
    return (await this.load()).find((r) => r.artist.email.toLowerCase() === e && r.release.title.toLowerCase() === t && r.release.releaseType === releaseType) ?? null;
  }

  async count() {
    return (await this.load()).length;
  }

  async stats(): Promise<Stats> {
    const rows = await this.load();
    const n = (s: Status) => rows.filter((r) => r.status === s).length;
    return { total: rows.length, submitted: n('Submitted'), underReview: n('Under Review'), approved: n('Approved'), rejected: n('Rejected') };
  }
}
