import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import type { PublicUser } from '../../shared/schema';
import { authLogin, authLogout, authMe, authRegister } from './api';

interface AuthState {
  user: PublicUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<PublicUser>;
  register: (name: string, email: string, password: string) => Promise<PublicUser>;
  logout: () => Promise<void>;
}
const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => { authMe().then((r) => setUser(r.user)).catch(() => setUser(null)).finally(() => setLoading(false)); }, []);

  const login = useCallback(async (e: string, p: string) => { const r = await authLogin(e, p); setUser(r.user); return r.user; }, []);
  const register = useCallback(async (n: string, e: string, p: string) => { const r = await authRegister(n, e, p); setUser(r.user); return r.user; }, []);
  const logout = useCallback(async () => { await authLogout().catch(() => undefined); setUser(null); }, []);
  return <Ctx.Provider value={{ user, loading, login, register, logout }}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useAuth outside AuthProvider');
  return c;
}
