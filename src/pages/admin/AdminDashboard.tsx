import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { GENRES, RELEASE_TYPES, STATUSES, type ReleaseRecord, type Stats } from '../../../shared/schema';
import { adminList, adminSheets, adminSheetsSync, adminStats, downloadExport, type AdminFilters, type SheetsInfo } from '../../lib/api';
import { formatDateTime } from '../../lib/format';
import { StatusBadge } from '../../components/StatusBadge';

const CARDS: Array<[keyof Stats, string, string]> = [
  ['total', 'Total submissions', ''], ['underReview', 'Under Review', 'Under Review'], ['processing', 'Processing', 'Processing'], ['approved', 'Approved', 'Approved'],
  ['needsChanges', 'Needs Changes', 'Needs Changes'], ['rejected', 'Rejected', 'Rejected'],
];

const syncLabel: Record<string, string> = { synced: '● synced', pending: '◌ pending', failed: '⚠ failed', disabled: '— sheet off', skipped: '— sample' };

export default function AdminDashboard() {
  const nav = useNavigate();
  const [filters, setFilters] = useState<AdminFilters>({ search: '', status: '', releaseType: '', genre: '', sort: 'desc' });
  const [search, setSearch] = useState('');
  const [rows, setRows] = useState<ReleaseRecord[] | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState<'' | 'xlsx' | 'csv'>('');
  const [notice, setNotice] = useState('');
  const [sheets, setSheets] = useState<SheetsInfo | null>(null);
  const [syncing, setSyncing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [l, s, g] = await Promise.all([adminList(filters), adminStats(), adminSheets()]);
      setRows(l.releases); setStats(s.stats); setSheets(g.sheets); setError('');
    } catch (e) { setError((e as Error).message); setRows((r) => r ?? []); }
  }, [filters]);
  useEffect(() => { load(); }, [load]);
  // The sheet can change status behind our back (that's the point), so keep the admin view fresh too.
  useEffect(() => { const t = setInterval(() => { if (document.visibilityState === 'visible') void load(); }, 10_000); return () => clearInterval(t); }, [load]);

  async function syncNow() {
    setSyncing(true); setError(''); setNotice('');
    try { const r = await adminSheetsSync(); setSheets(r.sheets); await load(); setNotice(r.sheets.lastPollOk ? 'Synced with Google Sheet.' : ''); if (!r.sheets.lastPollOk) setError(`Google Sheet sync failed: ${r.sheets.lastError ?? 'unknown error'}`); }
    catch (e) { setError((e as Error).message); }
    finally { setSyncing(false); }
  }
  useEffect(() => { const t = setTimeout(() => setFilters((f) => (f.search === search ? f : { ...f, search })), 250); return () => clearTimeout(t); }, [search]);

  const set = (k: keyof AdminFilters) => (v: string) => setFilters((f) => ({ ...f, [k]: v }));
  const active = filters.search || filters.status || filters.releaseType || filters.genre;

  async function doExport(fmt: 'xlsx' | 'csv') {
    setExporting(fmt); setNotice(''); setError('');
    try { const name = await downloadExport(fmt, filters); setNotice(`Downloaded ${name}`); }
    catch (e) { setError((e as Error).message); }
    finally { setExporting(''); }
  }

  return (
    <div className="wrap admin">
      <div className="admin-head">
        <div><p className="eyebrow">Admin · Demo</p><h1>Submissions</h1></div>
        <div className="export-btns">
          {sheets?.url && <a className="btn" href={sheets.url} target="_blank" rel="noopener noreferrer">Open Google Sheet ↗</a>}
          <button className="btn primary" onClick={() => doExport('xlsx')} disabled={!!exporting || !rows?.length}>{exporting === 'xlsx' ? 'Preparing…' : 'Export to Excel'}</button>
          <button className="btn" onClick={() => doExport('csv')} disabled={!!exporting || !rows?.length}>{exporting === 'csv' ? 'Preparing…' : 'Export CSV'}</button>
        </div>
      </div>
      {notice && <div className="banner ok" role="status">{notice}{active ? ' (filtered view)' : ''}</div>}
      {error && <div className="banner bad" role="alert">{error} <button className="link" onClick={load}>Retry</button></div>}

      {sheets && (
        <div className={`sheet-status ${!sheets.enabled ? 'off' : sheets.lastPollOk === false ? 'bad' : 'ok'}`} role="status">
          <span><strong>Google Sheet control panel:</strong>{' '}
            {!sheets.enabled ? 'not configured — running on the database only.'
              : sheets.lastPollOk === null ? 'starting…'
              : sheets.lastPollOk ? `connected · last poll ${new Date(sheets.lastPollAt!).toLocaleTimeString()} · every ${Math.round(sheets.pollIntervalMs / 1000)}s · ${sheets.lastSummary?.rows ?? 0} rows`
              : `last poll failed (${sheets.lastError}) — retrying automatically`}</span>
          {sheets.enabled && <button className="btn small" onClick={syncNow} disabled={syncing}>{syncing ? 'Syncing…' : 'Sync now'}</button>}
        </div>
      )}

      <div className="stat-cards">
        {CARDS.map(([k, label, st]) => (
          <button key={k} className={`stat ${filters.status === st && st ? 'on' : ''}`} onClick={() => set('status')(filters.status === st ? '' : st)} aria-pressed={!!st && filters.status === st}>
            <span className="stat-n">{stats ? stats[k] : '–'}</span><span className="stat-l">{label}</span>
          </button>
        ))}
      </div>

      <div className="filters" role="search">
        <input type="search" placeholder="Search artist, email, or release title…" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search submissions" />
        <select value={filters.status} onChange={(e) => set('status')(e.target.value)} aria-label="Filter by status"><option value="">All statuses</option>{STATUSES.map((s) => <option key={s}>{s}</option>)}</select>
        <select value={filters.releaseType} onChange={(e) => set('releaseType')(e.target.value)} aria-label="Filter by release type"><option value="">All types</option>{RELEASE_TYPES.map((s) => <option key={s}>{s}</option>)}</select>
        <select value={filters.genre} onChange={(e) => set('genre')(e.target.value)} aria-label="Filter by genre"><option value="">All genres</option>{GENRES.map((s) => <option key={s}>{s}</option>)}</select>
        <select value={filters.sort} onChange={(e) => set('sort')(e.target.value)} aria-label="Sort by submission date"><option value="desc">Newest first</option><option value="asc">Oldest first</option></select>
        {active && <button className="btn small ghost" onClick={() => { setSearch(''); setFilters({ search: '', status: '', releaseType: '', genre: '', sort: filters.sort }); }}>Clear</button>}
      </div>

      <div className="table-wrap">
        <table className="data">
          <thead><tr><th>ID</th><th>Artist</th><th>Email</th><th>Release</th><th>Type</th><th>Genre</th><th>Submitted</th><th>Status</th><th>Sheet</th></tr></thead>
          <tbody>
            {rows === null && <tr><td colSpan={9} className="empty">Loading…</td></tr>}
            {rows?.length === 0 && <tr><td colSpan={9} className="empty">{active ? 'No submissions match these filters.' : 'No submissions yet. Submit a release to see it here.'}</td></tr>}
            {rows?.map((r) => (
              <tr key={r.id} tabIndex={0} onClick={() => nav(`/admin/releases/${r.id}`)} onKeyDown={(e) => e.key === 'Enter' && nav(`/admin/releases/${r.id}`)}>
                <td data-label="ID" className="mono"><Link to={`/admin/releases/${r.id}`} onClick={(e) => e.stopPropagation()}>{r.id}</Link></td>
                <td data-label="Artist"><strong>{r.artist.displayName}</strong>{r.isDemoData && <span className="pill">sample</span>}</td>
                <td data-label="Email">{r.artist.email}</td>
                <td data-label="Release">{r.release.title}</td>
                <td data-label="Type">{r.release.releaseType}</td>
                <td data-label="Genre">{r.release.genre}</td>
                <td data-label="Submitted">{formatDateTime(r.createdAt)}</td>
                <td data-label="Status"><StatusBadge status={r.status} /></td>
                <td data-label="Sheet" className={`sync sync-${r.googleSheetSyncStatus}`}>{syncLabel[r.googleSheetSyncStatus]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="fine">{rows ? `${rows.length} shown` : ''}{active ? ' · Exports respect the current filters.' : ''}</p>
    </div>
  );
}
