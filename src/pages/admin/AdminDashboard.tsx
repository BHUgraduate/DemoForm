import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { GENRES, RELEASE_TYPES, STATUSES, type ReleaseRecord, type Stats } from '../../../shared/schema';
import { adminList, adminStats, downloadExport, type AdminFilters } from '../../lib/api';
import { formatDateTime } from '../../lib/format';
import { StatusBadge } from '../../components/StatusBadge';

const CARDS: Array<[keyof Stats, string, string]> = [
  ['total', 'Total submissions', ''], ['submitted', 'New', 'Submitted'], ['underReview', 'Processing', 'Under Review'], ['approved', 'Approved', 'Approved'], ['rejected', 'Rejected', 'Rejected'],
];

export default function AdminDashboard() {
  const nav = useNavigate();
  const [filters, setFilters] = useState<AdminFilters>({ search: '', status: '', releaseType: '', genre: '', sort: 'desc' });
  const [search, setSearch] = useState('');
  const [rows, setRows] = useState<ReleaseRecord[] | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState<'' | 'xlsx' | 'csv'>('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    try {
      const [l, s] = await Promise.all([adminList(filters), adminStats()]);
      setRows(l.releases); setStats(s.stats); setError('');
    } catch (e) { setError((e as Error).message); setRows((r) => r ?? []); }
  }, [filters]);
  useEffect(() => { load(); }, [load]);
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
          <button className="btn primary" onClick={() => doExport('xlsx')} disabled={!!exporting || !rows?.length}>{exporting === 'xlsx' ? 'Preparing…' : 'Export to Excel'}</button>
          <button className="btn" onClick={() => doExport('csv')} disabled={!!exporting || !rows?.length}>{exporting === 'csv' ? 'Preparing…' : 'Export CSV'}</button>
        </div>
      </div>
      {notice && <div className="banner ok" role="status">{notice}{active ? ' (filtered view)' : ''}</div>}
      {error && <div className="banner bad" role="alert">{error} <button className="link" onClick={load}>Retry</button></div>}

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
          <thead><tr><th>ID</th><th>Artist</th><th>Email</th><th>Release</th><th>Type</th><th>Genre</th><th>Submitted</th><th>Status</th></tr></thead>
          <tbody>
            {rows === null && <tr><td colSpan={8} className="empty">Loading…</td></tr>}
            {rows?.length === 0 && <tr><td colSpan={8} className="empty">{active ? 'No submissions match these filters.' : 'No submissions yet. Submit a release to see it here.'}</td></tr>}
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
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="fine">{rows ? `${rows.length} shown` : ''}{active ? ' · Exports respect the current filters.' : ''}</p>
    </div>
  );
}
