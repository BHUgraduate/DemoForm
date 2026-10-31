import type { ReactNode } from 'react';
import { dash, formatBytes, formatDate } from '../../lib/format';
import type { Draft } from '../../lib/draft';

function Section({ title, onEdit, children }: { title: string; onEdit: () => void; children: ReactNode }) {
  return (
    <section className="review-card">
      <header><h3>{title}</h3><button type="button" className="btn small" onClick={onEdit} aria-label={`Edit ${title}`}>Edit</button></header>
      {children}
    </section>
  );
}
const Row = ({ k, v }: { k: string; v: ReactNode }) => <div className="kv"><dt>{k}</dt><dd>{v}</dd></div>;

export function ReviewStep({ draft: d, goTo, errorSteps }: { draft: Draft; goTo: (n: number) => void; errorSteps: number[] }) {
  return (
    <>
      <p className="lede">Check everything below. You can edit any section before submitting.</p>
      {errorSteps.length > 0 && (
        <div className="banner bad" role="alert">
          Some sections are incomplete: {errorSteps.map((s) => ['Artist', 'Release', 'Tracks', 'Music file', 'Cover art', 'Stores', 'Rights'][s]).join(', ')}. Use the Edit buttons to fix them.
        </div>
      )}
      <Section title="Artist" onEdit={() => goTo(0)}>
        <dl>
          <Row k="Name" v={dash(d.artist.legalName)} /><Row k="Display name" v={dash(d.artist.displayName)} />
          <Row k="Email" v={dash(d.artist.email)} /><Row k="Phone" v={dash(d.artist.phone)} />
          <Row k="Country" v={dash(d.artist.country)} /><Row k="Type" v={dash(d.artist.artistType)} />
        </dl>
      </Section>
      <Section title="Release" onEdit={() => goTo(1)}>
        <dl>
          <Row k="Title" v={dash(d.release.title)} /><Row k="Type" v={dash(d.release.releaseType)} />
          <Row k="Genre" v={dash(d.release.genre)} /><Row k="Language" v={dash(d.release.language)} />
          <Row k="Release date" v={formatDate(d.release.releaseDate)} /><Row k="Explicit" v={dash(d.release.explicit)} />
        </dl>
      </Section>
      <Section title="Tracks" onEdit={() => goTo(2)}>
        <ol className="track-list">
          {d.tracks.map((t, i) => <li key={i}><span className="n">{t.trackNumber}</span><span>{dash(t.title)}{t.version !== 'Original' && <em> ({t.version})</em>}</span><span className="muted">{t.explicit === 'Yes' ? 'Explicit' : ''}</span></li>)}
        </ol>
      </Section>
      <Section title="Files" onEdit={() => goTo(3)}>
        <dl>
          <Row k="Audio file" v={d.audio ? `${d.audio.originalName} (${formatBytes(d.audio.size)})` : '—'} />
          <Row k="Cover artwork" v={d.artwork ? `${d.artwork.originalName} (${formatBytes(d.artwork.size)}${d.artwork.width ? `, ${d.artwork.width}×${d.artwork.height}` : ''})` : '—'} />
        </dl>
      </Section>
      <Section title="Distribution" onEdit={() => goTo(5)}>
        <div className="chips">{d.stores.length ? d.stores.map((s) => <span className="chip" key={s}>{s}</span>) : <span className="muted">None selected</span>}</div>
      </Section>
      <Section title="Rights" onEdit={() => goTo(6)}>
        <ul className="checks">
          <li className={d.rights.ownsRights ? 'yes' : 'no'}>Owns or controls distribution rights</li>
          <li className={d.rights.infoAccurate ? 'yes' : 'no'}>Information is accurate</li>
          <li className={d.rights.authorizeProcessing ? 'yes' : 'no'}>Authorizes processing of this submission</li>
        </ul>
      </Section>
    </>
  );
}
