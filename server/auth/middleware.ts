import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { PublicUser } from '../../shared/schema.ts';
import type { JsonUserRepository, UserRecord } from '../storage/userRepository.ts';
import { readToken } from './security.ts';

export const COOKIE = 'sl_session';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express { interface Request { user?: UserRecord } }
}

export const toPublic = (u: UserRecord): PublicUser => ({ id: u.id, name: u.name, email: u.email, role: u.role });

export function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of (header || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

/** Attaches req.user when a valid session cookie is present. Never rejects by itself. */
export function sessionLoader(users: JsonUserRepository, secret: () => string): RequestHandler {
  return async (req, _res, next) => {
    try {
      const id = readToken(parseCookies(req.headers.cookie)[COOKIE], secret());
      if (id) req.user = (await users.findById(id)) ?? undefined;
    } catch { /* treat as signed out */ }
    next();
  };
}

export const requireUser: RequestHandler = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) return void res.status(401).json({ success: false, message: 'Please sign in to continue.' });
  next();
};

export const requireAdmin: RequestHandler = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) return void res.status(401).json({ success: false, message: 'Please sign in to continue.' });
  if (req.user.role !== 'admin') return void res.status(403).json({ success: false, message: 'Administrator access is required.' });
  next();
};
