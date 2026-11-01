import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ApiError, myReleases, type MyRelease } from '../lib/api';
import { useAuth } from '../lib/auth';
import { formatDateTime } from '../lib/format';
import { StatusBadge, statusClass } from '../components/StatusBadge';

/** How often the dashboard re-reads the backend (database only — never Google). Paused while the tab is hidden. */
const REFRESH_MS = 10_000;

export default function Dashboard() {
  const { user } = useAuth();
  const [params] = useSearchParams();
  const highlight = params.get('highlight');
  const [rows, setRows] = useState<MyRelease[] | null>(null);
  const [error, setError] = useState('');
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [flash, setFlash] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    try {
      const r = await myReleases();
      setRows((prev) => {
        if (prev) {
          const changed: Record<string, boolean> = {};
          for (const n of r.releases) { const o = prev.find((p) => p.id === n.id); if (o && (o.status !== n.status || o.adminNote !== n.adminNote)) changed[n.id] = true; }
          if (Object.keys(changed).length) { setFlash((f) => ({ ...f, ...changed })); setTimeout(() => setFlash({}), 4000); }
        }
        return r.releases;
      });
      setUpdatedAt(new Date()); setError('');
    } catch (e) {
      setError(e instanceof ApiError && e.status === 401 ? 'Your session has expired. Please sign in again.' : (e as Error).message);
      setRows((r) => r ?? []);
    }
  }, []);

  useEffect(() => {
    void load();
    const t = setInterval(() => { if (document.visibilityState === 'visible') void load(); }, REFRESH_MS);
    const onVis = () => { if (document.visibilityState === 'visible') void load(); };
    document.addEventListener('visibilitychange', onVis);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', onVis); };
  }, [load]);

  return (
    <div className="wrap admin">
      <div className="admin-head">
        <div><p className="eyebrow">Artist dashboard</p><h1>My Releases</h1><p className="blurb">Signed in as {user?.name}. Statuses refresh automatically.</p></div>
        <Link to="/distribute" className="btn primary">+ New release</Link>
      </div>
      {error && <div className="banner bad" role="alert">{error} <button className="link" onClick={load}>Retry</button></div>}

      {rows === null && <p>Loading…</p>}
      {rows?.length === 0 && !error && (
        <div className="panel empty-state">
          <h2>No releases yet</h2>
          <p className="blurb">Submit your first release and track its review status here.</p>
          <Link to="/distribute" className="btn primary big">Distribute Your Music</Link>
        </div>
      )}
      <div className="release-list">
        {rows?.map((r) => (
          <article key={r.id} className={`release-card ${highlight === r.id ? 'highlight' : ''} ${flash[r.id] ? 'flash' : ''}`} aria-label={r.title}>
            <div className="release-main">
              <h2>{r.title}</h2>
              <p className="muted">{r.releaseType} · {r.genre} · {r.trackCount} track{r.trackCount === 1 ? '' : 's'}</p>
              <p className="fine mono">{r.id} · submitted {formatDateTime(r.createdAt)}</p>
            </div>
            <div className="release-status">
              <span className="label-sm">Status</span>
              <div className={`status-big ${statusClass(r.status)}`} data-testid={`status-${r.id}`}><StatusBadge status={r.status} icon /></div>
              {r.adminNote && <div className="admin-message"><span className="label-sm">Admin message</span><p>{r.adminNote}</p></div>}
            </div>
          </article>
        ))}
      </div>
      {updatedAt && <p className="fine">Last checked {updatedAt.toLocaleTimeString()} · refreshes every {REFRESH_MS / 1000}s</p>}
    </div>
  );
}
