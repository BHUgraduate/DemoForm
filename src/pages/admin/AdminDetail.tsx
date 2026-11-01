import { useEffect, useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { STATUSES, type ReleaseRecord } from '../../../shared/schema';
import { adminGet, adminSetStatus } from '../../lib/api';
import { dash, formatBytes, formatDate, formatDateTime } from '../../lib/format';
import { StatusBadge } from '../../components/StatusBadge';

const Row = ({ k, v }: { k: string; v: ReactNode }) => <div className="kv"><dt>{k}</dt><dd>{v === '' || v == null ? '—' : v}</dd></div>;
const Card = ({ title, children }: { title: string; children: ReactNode }) => <section className="review-card"><header><h3>{title}</h3></header>{children}</section>;
const Link2 = ({ href }: { href: string }) => (href ? <a href={href} target="_blank" rel="noopener noreferrer">{href}</a> : '—');

export default function AdminDetail() {
  const { id = '' } = useParams();
  const [r, setR] = useState<ReleaseRecord | null>(null);
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState('');
  const [note, setNote] = useState('');
  const [pending, setPending] = useState('');
  const [artOk, setArtOk] = useState(true);

  useEffect(() => { adminGet(id).then((x) => { setR(x.release); setNote(x.release.adminNote); setPending(x.release.status); }).catch((e) => setErr(e.message)); }, [id]);

  async function save() {
    setSaving(true); setSaved(''); setErr('');
    try { const x = await adminSetStatus(id, pending, note); setR(x.release); setSaved(`Saved: “${x.release.status}”. ${x.release.googleSheetSyncStatus === 'synced' ? 'Google Sheet updated.' : x.release.googleSheetSyncStatus === 'disabled' ? '' : 'Google Sheet sync will retry automatically.'}`); }
    catch (e) { setErr((e as Error).message); }
    finally { setSaving(false); }
  }

  if (err && !r) return <div className="wrap narrow"><div className="banner bad" role="alert">{err}</div><Link to="/admin" className="btn">← Back to submissions</Link></div>;
  if (!r) return <div className="wrap narrow"><p>Loading…</p></div>;
  const a = r.artist, rel = r.release;
  const base = `/api/admin/releases/${encodeURIComponent(r.id)}/files`;

  return (
    <div className="wrap admin detail">
      <Link to="/admin" className="back">← All submissions</Link>
      <div className="admin-head">
        <div>
          <p className="eyebrow mono">{r.id}{r.isDemoData && ' · sample data'}</p>
          <h1>{rel.title}</h1>
          <p className="blurb">{rel.releaseType} by {rel.primaryArtist} · submitted {formatDateTime(r.createdAt)}</p>
        </div>
        <div className="status-box">
          <label htmlFor="status">Status</label>
          <div className="status-row"><StatusBadge status={r.status} />
            <select id="status" value={pending} disabled={saving} onChange={(e) => setPending(e.target.value)}>{STATUSES.map((s) => <option key={s}>{s}</option>)}</select>
          </div>
          <label htmlFor="note">Admin note (shown to the artist)</label>
          <textarea id="note" rows={2} maxLength={1000} value={note} disabled={saving} onChange={(e) => setNote(e.target.value)} />
          <button className="btn primary small" onClick={save} disabled={saving || (pending === r.status && note === r.adminNote)}>{saving ? 'Saving…' : 'Save status'}</button>
          <p className="fine">You can also change Status and Admin Note directly in the Google Sheet.</p>
        </div>
      </div>
      {saved && <div className="banner ok" role="status">{saved}</div>}
      {err && <div className="banner bad" role="alert">{err}</div>}

      <div className="detail-grid">
        <div className="detail-main">
          <Card title="Artist"><dl>
            <Row k="Legal name" v={a.legalName} /><Row k="Display name" v={a.displayName} /><Row k="Email" v={<a href={`mailto:${a.email}`}>{a.email}</a>} />
            <Row k="Phone" v={a.phone} /><Row k="Country" v={a.country} /><Row k="State / region" v={dash(a.state)} /><Row k="City" v={dash(a.city)} /><Row k="Artist type" v={a.artistType} />
            <Row k="Instagram" v={dash(a.instagram)} /><Row k="YouTube" v={<Link2 href={a.youtube} />} /><Row k="Spotify" v={<Link2 href={a.spotifyUrl} />} /><Row k="Apple Music" v={<Link2 href={a.appleMusicUrl} />} />
          </dl></Card>
          <Card title="Release"><dl>
            <Row k="Type" v={rel.releaseType} /><Row k="Title" v={rel.title} /><Row k="Primary artist" v={rel.primaryArtist} /><Row k="Featuring" v={dash(rel.featuringArtists)} />
            <Row k="Genre" v={rel.genre} /><Row k="Subgenre" v={dash(rel.subgenre)} /><Row k="Language" v={rel.language} /><Row k="Explicit" v={rel.explicit} />
            <Row k="Release date" v={formatDate(rel.releaseDate)} /><Row k="Original release" v={rel.originalRelease} /><Row k="Previously released" v={rel.previouslyReleased} />
            {rel.previouslyReleased === 'Yes' && <><Row k="Previous release date" v={formatDate(rel.previousReleaseDate)} /><Row k="UPC / ISRC" v={dash(rel.upc)} /></>}
            <Row k="Songwriters" v={rel.songwriters} /><Row k="Composers" v={rel.composers} /><Row k="Lyricists" v={dash(rel.lyricists)} /><Row k="Producers" v={dash(rel.producers)} />
            <Row k="Copyright owner" v={rel.copyrightOwner} /><Row k="Publishing" v={dash(rel.publishingInfo)} />
          </dl></Card>
          <Card title={`Tracks (${r.tracks.length})`}>
            <div className="table-wrap flat"><table className="data compact">
              <thead><tr><th>#</th><th>Title</th><th>Version</th><th>Artist</th><th>Featured</th><th>ISRC</th><th>Credits</th><th>Language</th><th>Explicit</th></tr></thead>
              <tbody>{r.tracks.map((t, i) => (
                <tr key={i}><td data-label="#">{t.trackNumber}</td><td data-label="Title"><strong>{t.title}</strong></td><td data-label="Version">{t.version}</td><td data-label="Artist">{t.primaryArtist}</td>
                  <td data-label="Featured">{dash(t.featuredArtists)}</td><td data-label="ISRC" className="mono">{dash(t.isrc)}</td><td data-label="Credits">{[t.songwriter && `Writer: ${t.songwriter}`, t.composer && `Composer: ${t.composer}`, t.lyricist && `Lyrics: ${t.lyricist}`, t.producer && `Producer: ${t.producer}`].filter(Boolean).join(' · ') || '—'}</td><td data-label="Language">{t.language}</td><td data-label="Explicit">{t.explicit}</td></tr>
              ))}</tbody></table></div>
            {r.tracks.some((t) => t.lyrics) && r.tracks.filter((t) => t.lyrics).map((t, i) => <details key={i}><summary>Lyrics — {t.title}</summary><pre className="lyrics">{t.lyrics}</pre></details>)}
          </Card>
        </div>

        <aside className="detail-side">
          <Card title="Files">
            {r.artwork.available && artOk
              ? <img className="cover-large" src={`${base}/artwork`} alt={`Cover art for ${rel.title}`} onError={() => setArtOk(false)} />
              : <div className="cover-large placeholder" aria-hidden="true">♪<small>{r.isDemoData ? 'Sample data — no file stored' : 'Preview unavailable'}</small></div>}
            <dl>
              <Row k="Cover" v={r.artwork.originalName} /><Row k="Format" v={`${r.artwork.mimeType}${r.artwork.width ? ` · ${r.artwork.width}×${r.artwork.height}` : ''}`} /><Row k="Cover size" v={formatBytes(r.artwork.size)} />
              <Row k="Audio" v={r.audio.originalName} /><Row k="Audio type" v={r.audio.mimeType} /><Row k="Audio size" v={formatBytes(r.audio.size)} /><Row k="Uploaded" v={formatDateTime(r.audio.uploadedAt)} />
            </dl>
            {r.audio.available ? <>
              <audio controls preload="none" src={`${base}/audio`} className="audio" />
              <a className="btn small" href={`${base}/audio?download=1`}>Download audio</a>
            </> : <p className="fine">Audio bytes are not stored for sample rows.</p>}
          </Card>
          <Card title="Distribution stores"><div className="chips">{r.stores.map((s) => <span className="chip" key={s}>{s}</span>)}{r.otherPlatforms && <span className="chip">{r.otherPlatforms}</span>}</div></Card>
          <Card title="Rights declarations"><ul className="checks">
            <li className={r.rights.ownsRights ? 'yes' : 'no'}>Owns or controls distribution rights</li>
            <li className={r.rights.infoAccurate ? 'yes' : 'no'}>Information is accurate</li>
            <li className={r.rights.authorizeProcessing ? 'yes' : 'no'}>Authorizes processing</li>
          </ul></Card>
          <Card title="Record"><dl><Row k="Created" v={formatDateTime(r.createdAt)} /><Row k="Last updated" v={formatDateTime(r.updatedAt)} /><Row k="Status" v={<StatusBadge status={r.status} />} /><Row k="Admin note" v={dash(r.adminNote)} /><Row k="Google Sheet" v={`${r.googleSheetSyncStatus}${r.googleSheetRow ? ` · row ${r.googleSheetRow}` : ''}`} />{r.googleSheetLastError && <Row k="Last sync error" v={r.googleSheetLastError} />}</dl></Card>
        </aside>
      </div>
    </div>
  );
}
