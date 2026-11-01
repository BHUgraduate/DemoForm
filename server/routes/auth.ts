import { Router, type Response } from 'express';
import { z } from 'zod';
import { config } from '../config.ts';
import { COOKIE, toPublic } from '../auth/middleware.ts';
import { createToken, hashPassword, verifyPassword } from '../auth/security.ts';
import { sanitizeText } from '../../shared/schema.ts';
import type { Deps } from '../app.ts';

const dummyHash = hashPassword('not-a-real-password');

const registerSchema = z.object({
  name: z.string().transform(sanitizeText).pipe(z.string().min(1, 'Name is required').max(100)),
  email: z.string().transform((v) => v.trim().toLowerCase()).pipe(z.string().email('Enter a valid email address').max(254)),
  password: z.string().min(8, 'Password must be at least 8 characters').max(200),
});

export function authRoutes({ users, secret }: Deps) {
  const router = Router();

  const startSession = (res: Response, userId: string) => {
    const token = createToken(userId, config.auth.sessionHours, secret());
    res.cookie(COOKIE, token, { httpOnly: true, sameSite: 'lax', secure: config.auth.cookieSecure, maxAge: config.auth.sessionHours * 3600_000, path: '/' });
  };

  // Tiny in-memory throttle: 10 failed sign-ins per email+IP per 15 min. (Production: shared store + proper lockout.)
  const fails = new Map<string, { n: number; until: number }>();

  router.post('/register', async (req, res) => {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) return void res.status(400).json({ success: false, message: parsed.error.issues[0].message });
    const user = await users.create({ name: parsed.data.name, email: parsed.data.email, role: 'artist', passwordHash: await hashPassword(parsed.data.password) });
    if (!user) return void res.status(409).json({ success: false, message: 'An account with this email already exists. Try signing in.' });
    startSession(res, user.id);
    res.status(201).json({ success: true, user: toPublic(user) });
  });

  router.post('/login', async (req, res) => {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    const key = `${req.ip}|${email}`;
    const f = fails.get(key);
    if (f && f.n >= 10 && f.until > Date.now()) return void res.status(429).json({ success: false, message: 'Too many attempts. Please wait a few minutes.' });
    const user = email ? await users.findByEmail(email) : null;
    // Always run a hash comparison so timing doesn't reveal whether the email exists.
    const ok = user ? await verifyPassword(password, user.passwordHash) : (await verifyPassword(password, await dummyHash), false);
    if (!user || !ok) {
      fails.set(key, { n: (f && f.until > Date.now() ? f.n : 0) + 1, until: Date.now() + 15 * 60_000 });
      return void res.status(401).json({ success: false, message: 'Incorrect email or password.' });
    }
    fails.delete(key);
    startSession(res, user.id);
    res.json({ success: true, user: toPublic(user) });
  });

  router.post('/logout', (_req, res) => { res.clearCookie(COOKIE, { path: '/' }); res.json({ success: true }); });
  router.get('/me', (req, res) => res.json({ success: true, user: req.user ? toPublic(req.user) : null }));

  router.get('/config', (_req, res) => res.json({
    success: true,
    demoLogins: config.auth.showDemoLogins
      ? [{ role: 'artist', email: 'artist@example.com', password: DEMO_ARTIST_PASSWORD }, { role: 'admin', email: config.auth.adminEmail, password: config.auth.adminPassword }]
      : [],
  }));

  return router;
}

export const DEMO_ARTIST_PASSWORD = 'artist-demo-123';
