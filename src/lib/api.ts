import type { ReleaseRecord, Stats, SubmitResponse } from '../../shared/schema';
import type { UploadedMeta } from './draft';

export class ApiError extends Error {
  constructor(message: string, public status = 0, public fieldErrors?: Record<string, string>) { super(message); }
}

const NETWORK_MSG = "We couldn't reach the server. Check your connection (or that the API is running) and try again.";

async function parse(res: Response) {
  let body: any = null;
  try { body = await res.json(); } catch { /* non-JSON error page */ }
  if (!res.ok) throw new ApiError(body?.message || `Request failed (${res.status}). Please try again.`, res.status, body?.fieldErrors);
  return body;
}

async function request(url: string, init?: RequestInit) {
  let res: Response;
  try { res = await fetch(url, init); } catch { throw new ApiError(NETWORK_MSG); }
  return parse(res);
}

/** Real multipart upload with progress events (fetch can't report upload progress). */
export function uploadFile(kind: 'audio' | 'artwork', file: File, onProgress: (pct: number) => void, signal?: AbortSignal): Promise<UploadedMeta> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `/api/uploads/${kind}`);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(Math.round((e.loaded / e.total) * 100));
    xhr.onerror = () => reject(new ApiError(NETWORK_MSG));
    xhr.onabort = () => reject(new ApiError('Upload cancelled.'));
    xhr.onload = () => {
      let body: any = null;
      try { body = JSON.parse(xhr.responseText); } catch { /* ignore */ }
      if (xhr.status >= 200 && xhr.status < 300 && body?.file) resolve(body.file as UploadedMeta);
      else reject(new ApiError(body?.message || `Upload failed (${xhr.status}). Please try again.`, xhr.status));
    };
    signal?.addEventListener('abort', () => xhr.abort());
    const fd = new FormData();
    fd.append('file', file);
    xhr.send(fd);
  });
}

export async function submitRelease(payload: unknown): Promise<SubmitResponse> {
  return request('/api/releases', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
}

export const getReceipt = (id: string): Promise<{ submission: { id: string; status: string; createdAt: string; title: string; releaseType: string; artist: string } }> =>
  request(`/api/releases/${encodeURIComponent(id)}`);

/* ── admin (DEMO: unauthenticated) ── */
export interface AdminFilters { search: string; status: string; releaseType: string; genre: string; sort: 'asc' | 'desc' }
const qs = (f: Partial<AdminFilters>) => {
  const p = new URLSearchParams();
  Object.entries(f).forEach(([k, v]) => v && p.set(k, String(v)));
  return p.toString();
};
export const adminList = (f: AdminFilters): Promise<{ releases: ReleaseRecord[] }> => request(`/api/admin/releases?${qs(f)}`);
export const adminStats = (): Promise<{ stats: Stats }> => request('/api/admin/stats');
export const adminGet = (id: string): Promise<{ release: ReleaseRecord }> => request(`/api/admin/releases/${encodeURIComponent(id)}`);
export const adminSetStatus = (id: string, status: string): Promise<{ release: ReleaseRecord }> =>
  request(`/api/admin/releases/${encodeURIComponent(id)}/status`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) });

/** Fetches the export as a blob (so failures surface as messages, not a blank tab) then triggers a download. */
export async function downloadExport(format: 'xlsx' | 'csv', f: AdminFilters) {
  let res: Response;
  try { res = await fetch(`/api/admin/export.${format}?${qs(f)}`); } catch { throw new ApiError(NETWORK_MSG); }
  if (!res.ok) throw new ApiError('The export could not be generated. Please try again.', res.status);
  const name = /filename="([^"]+)"/.exec(res.headers.get('content-disposition') || '')?.[1] || `export.${format}`;
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement('a');
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return name;
}
