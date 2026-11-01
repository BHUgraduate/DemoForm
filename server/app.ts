import express, { type ErrorRequestHandler } from 'express';
import path from 'node:path';
import fs from 'node:fs';
import type { FileStorage } from './storage/fileStorage.ts';
import type { ReleaseRepository } from './storage/releaseRepository.ts';
import { publicRoutes } from './routes/public.ts';
import { adminRoutes } from './routes/admin.ts';
import { authRoutes } from './routes/auth.ts';
import { requireAdmin, sessionLoader } from './auth/middleware.ts';
import type { JsonUserRepository } from './storage/userRepository.ts';
import type { SheetsSync } from './sheets/sync.ts';

export interface Deps {
  files: FileStorage;
  releases: ReleaseRepository;
  users: JsonUserRepository;
  sync: SheetsSync;
  /** Session-signing secret (resolved at startup; a function so it can be filled in lazily). */
  secret: () => string;
}

export function createApp(deps: Deps) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req, res) => res.json({ ok: true }));
  app.use('/api', sessionLoader(deps.users, deps.secret));
  app.use('/api/auth', authRoutes(deps));
  app.use('/api/admin', requireAdmin, adminRoutes(deps));
  app.use('/api', publicRoutes(deps));
  app.use('/api', (_req, res) => res.status(404).json({ success: false, message: 'Not found.' }));

  // Production: serve the built React app and fall back to index.html for client-side routes.
  const dist = path.resolve('dist');
  if (fs.existsSync(path.join(dist, 'index.html'))) {
    app.use(express.static(dist));
    app.get(/^(?!\/api).*/, (_req, res) => res.sendFile(path.join(dist, 'index.html')));
  }

  // Internal errors are logged server-side only; the user gets a generic message.
  const onError: ErrorRequestHandler = (err, _req, res, _next) => {
    if (err?.type === 'entity.parse.failed') return res.status(400).json({ success: false, message: 'The request could not be read.' });
    console.error('[error]', err);
    res.status(500).json({ success: false, message: 'Something went wrong on our side. Please try again.' });
  };
  app.use(onError);
  return app;
}
