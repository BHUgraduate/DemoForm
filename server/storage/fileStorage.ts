import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { StoredFile } from '../../shared/schema.ts';

export type FileKind = 'audio' | 'artwork';

export interface UploadedFileRecord extends StoredFile {
  id: string;
  kind: FileKind;
}

/**
 * File-storage abstraction. The demo writes to local disk; a production build would
 * implement this same interface against S3 / GCS / Azure Blob (with virus scanning,
 * signed URLs, and lifecycle rules) without touching any route code.
 */
export interface FileStorage {
  save(kind: FileKind, data: Buffer, meta: { originalName: string; mimeType: string; width?: number; height?: number }): Promise<UploadedFileRecord>;
  get(id: string): Promise<UploadedFileRecord | null>;
  read(id: string): Promise<Buffer | null>;
}

const ID_RE = /^[a-f0-9-]{36}$/;

export class LocalFileStorage implements FileStorage {
  private dir: string;
  constructor(baseDir: string) {
    this.dir = path.join(baseDir, 'uploads');
  }

  private async ensure() {
    await fs.mkdir(this.dir, { recursive: true });
  }

  async save(kind: FileKind, data: Buffer, meta: { originalName: string; mimeType: string; width?: number; height?: number }) {
    await this.ensure();
    const id = randomUUID();
    const record: UploadedFileRecord = {
      id, kind, available: true,
      originalName: meta.originalName, mimeType: meta.mimeType, size: data.length,
      uploadedAt: new Date().toISOString(),
      width: meta.width, height: meta.height,
    };
    // Stored under a generated id: the client-supplied filename never touches the filesystem path.
    await fs.writeFile(path.join(this.dir, id + '.bin'), data);
    await fs.writeFile(path.join(this.dir, id + '.json'), JSON.stringify(record, null, 2));
    return record;
  }

  async get(id: string) {
    if (!ID_RE.test(id)) return null;
    try {
      return JSON.parse(await fs.readFile(path.join(this.dir, id + '.json'), 'utf8')) as UploadedFileRecord;
    } catch {
      return null;
    }
  }

  async read(id: string) {
    if (!ID_RE.test(id)) return null;
    try {
      return await fs.readFile(path.join(this.dir, id + '.bin'));
    } catch {
      return null;
    }
  }
}
