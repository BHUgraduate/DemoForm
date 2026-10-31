import { Router } from 'express';
import { z } from 'zod';
import { STATUSES } from '../../shared/schema.ts';
import type { Deps } from '../app.ts';
import { buildCsv, buildWorkbook, exportFilename } from '../export/xlsx.ts';

/**
 * DEMO ADMIN API — intentionally unauthenticated so the client walkthrough is frictionless.
 * PRODUCTION: put every route here behind real authentication + role-based authorisation + audit logging.
 */
export function adminRoutes({ files, releases }: Deps) {
  const router = Router();

  const q = (v: unknown) => (typeof v === 'string' ? v.slice(0, 200) : undefined);
  const filters = (query: Record<string, unknown>) => ({
    search: q(query.search),
    status: q(query.status),
    releaseType: q(query.releaseType),
    genre: q(query.genre),
    sort: query.sort === 'asc' ? ('asc' as const) : ('desc' as const),
  });

  router.get('/stats', async (_req, res) => res.json({ success: true, stats: await releases.stats() }));

  router.get('/releases', async (req, res) => {
    const list = await releases.list(filters(req.query));
    res.json({ success: true, releases: list });
  });

  // Export routes are registered before /releases/:id so "export" is never mistaken for an id.
  router.get('/export.xlsx', async (req, res) => {
    const buf = await buildWorkbook(await releases.list(filters(req.query)));
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${exportFilename('xlsx')}"`);
    res.setHeader('Cache-Control', 'no-store');
    res.send(buf);
  });

  router.get('/export.csv', async (req, res) => {
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${exportFilename('csv')}"`);
    res.setHeader('Cache-Control', 'no-store');
    res.send(buildCsv(await releases.list(filters(req.query))));
  });

  router.get('/releases/:id', async (req, res) => {
    const r = await releases.get(req.params.id);
    if (!r) return res.status(404).json({ success: false, message: 'Submission not found.' });
    res.json({ success: true, release: r });
  });

  router.patch('/releases/:id/status', async (req, res) => {
    const parsed = z.object({ status: z.enum(STATUSES) }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ success: false, message: 'Invalid status.' });
    const updated = await releases.updateStatus(req.params.id, parsed.data.status);
    if (!updated) return res.status(404).json({ success: false, message: 'Submission not found.' });
    res.json({ success: true, release: updated });
  });

  // Serves the stored upload for preview/download. Looked up by submission, never by a client-supplied path.
  router.get('/releases/:id/files/:kind', async (req, res) => {
    const r = await releases.get(req.params.id);
    const kind = req.params.kind;
    if (!r || (kind !== 'audio' && kind !== 'artwork')) return res.status(404).json({ success: false, message: 'File not found.' });
    const id = kind === 'audio' ? r.files.audioFileId : r.files.artworkFileId;
    const meta = r[kind];
    const data = r.isDemoData ? null : await files.read(id);
    if (!data) return res.status(404).json({ success: false, message: 'File bytes are not stored for this submission.' });
    res.setHeader('Content-Type', meta.mimeType);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Disposition', `${req.query.download ? 'attachment' : 'inline'}; filename="${encodeURIComponent(meta.originalName)}"`);
    res.send(data);
  });

  return router;
}
