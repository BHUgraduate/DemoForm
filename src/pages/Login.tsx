import { useEffect, useState, type FormEvent } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { authConfig } from '../lib/api';
import { useAuth } from '../lib/auth';
import { TextField } from '../components/Field';

export default function Login() {
  const { user, login, register } = useAuth();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const rawNext = params.get('next') || '';
  const next = rawNext.startsWith('/') && !rawNext.startsWith('//') ? rawNext : ''; // same-site paths only
  const [mode, setMode] = useState<'login' | 'register'>(params.get('mode') === 'register' ? 'register' : 'login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [demo, setDemo] = useState<Array<{ role: string; email: string; password: string }>>([]);
  useEffect(() => { authConfig().then((c) => setDemo(c.demoLogins)).catch(() => undefined); }, []);

  if (user) return <Navigate to={next || (user.role === 'admin' ? '/admin' : '/dashboard')} replace />;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(''); setBusy(true);
    try {
      const u = mode === 'login' ? await login(email, password) : await register(name, email, password);
      nav(next || (u.role === 'admin' ? '/admin' : '/dashboard'), { replace: true });
    } catch (err) { setError((err as Error).message); }
    finally { setBusy(false); }
  }

  return (
    <div className="wrap narrow">
      <p className="eyebrow">{mode === 'login' ? 'Welcome back' : 'Create your account'}</p>
      <h1>{mode === 'login' ? 'Sign in' : 'Join as an artist'}</h1>
      <form className="panel auth-panel" onSubmit={submit} noValidate>
        {error && <div className="banner bad" role="alert">{error}</div>}
        {mode === 'register' && <TextField label="Your name" required value={name} onChange={setName} autoComplete="name" />}
        <TextField label="Email" required type="email" inputMode="email" autoComplete="email" value={email} onChange={setEmail} />
        <TextField label="Password" required type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={password} onChange={setPassword} hint={mode === 'register' ? 'At least 8 characters.' : undefined} />
        <div className="actions left">
          <button className="btn primary big" disabled={busy}>{busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}</button>
          <button type="button" className="link" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); }}>
            {mode === 'login' ? 'New here? Create an account' : 'Have an account? Sign in'}
          </button>
        </div>
      </form>
      {demo.length > 0 && (
        <div className="demo-logins">
          <p className="eyebrow">Demo accounts</p>
          {demo.map((d) => (
            <button key={d.email} type="button" className="btn small" onClick={() => { setMode('login'); setEmail(d.email); setPassword(d.password); }}>
              Fill {d.role}: {d.email}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
