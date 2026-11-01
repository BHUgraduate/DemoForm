import { LANGUAGES, TRACK_VERSIONS } from '../../../shared/schema';
import { newTrack } from '../../lib/draft';
import { SelectField, Segmented, TextArea, TextField } from '../Field';
import type { StepProps } from './types';

export function TracksStep({ draft, errors, update }: StepProps) {
  const setTrack = (i: number, k: string, v: string | number) =>
    update((d) => ({ ...d, tracks: d.tracks.map((t, j) => (j === i ? { ...t, [k]: v } : t)) }));
  const add = () => update((d) => {
    const next = Math.max(0, ...d.tracks.map((t) => Number(t.trackNumber) || 0)) + 1;
    return { ...d, tracks: [...d.tracks, { ...newTrack(next, d.release.primaryArtist || d.artist.displayName), language: d.release.language, explicit: d.release.explicit }] };
  });
  const remove = (i: number) => update((d) => ({ ...d, tracks: d.tracks.filter((_, j) => j !== i) }));

  return (
    <>
      {errors['tracks'] && <p className="err" role="alert">{errors['tracks']}</p>}
      {draft.tracks.map((t, i) => {
        const e = (k: string) => errors[`tracks.${i}.${k}`];
        return (
          <section key={i} className="track-card" aria-label={`Track ${i + 1}`}>
            <header>
              <h3>Track {i + 1}</h3>
              {draft.tracks.length > 1 && <button type="button" className="btn small ghost" onClick={() => remove(i)}>Remove</button>}
            </header>
            <div className="grid-2">
              <TextField label="Track title" required value={t.title} onChange={(v) => setTrack(i, 'title', v)} error={e('title')} />
              <SelectField label="Version" required value={t.version} onChange={(v) => setTrack(i, 'version', v)} options={TRACK_VERSIONS} error={e('version')} />
              <TextField label="Track number" required type="number" inputMode="numeric" min={1} value={String(t.trackNumber)} onChange={(v) => setTrack(i, 'trackNumber', v === '' ? ('' as never) : Number(v))} error={e('trackNumber')} />
              <TextField label="Primary artist" required value={t.primaryArtist} onChange={(v) => setTrack(i, 'primaryArtist', v)} error={e('primaryArtist')} />
              <TextField label="Featured artist(s)" value={t.featuredArtists} onChange={(v) => setTrack(i, 'featuredArtists', v)} error={e('featuredArtists')} />
              <TextField label="ISRC" value={t.isrc} onChange={(v) => setTrack(i, 'isrc', v.toUpperCase())} error={e('isrc')} placeholder="US-ABC-26-00001" hint="Leave blank if you don't have one yet." />
              <SelectField label="Language" required value={t.language} onChange={(v) => setTrack(i, 'language', v)} options={LANGUAGES} error={e('language')} />
              <Segmented label="Explicit content" name={`explicit-${i}`} required value={t.explicit} onChange={(v) => setTrack(i, 'explicit', v)} options={['Yes', 'No']} error={e('explicit')} />
            </div>
            <h4 className="subhead-sm">Credits <span className="optional">optional</span></h4>
            <div className="grid-2">
              <TextField label="Songwriter" value={t.songwriter} onChange={(v) => setTrack(i, 'songwriter', v)} error={e('songwriter')} />
              <TextField label="Composer" value={t.composer} onChange={(v) => setTrack(i, 'composer', v)} error={e('composer')} />
              <TextField label="Lyricist" value={t.lyricist} onChange={(v) => setTrack(i, 'lyricist', v)} error={e('lyricist')} />
              <TextField label="Producer" value={t.producer} onChange={(v) => setTrack(i, 'producer', v)} error={e('producer')} />
            </div>
            <TextArea label="Lyrics" value={t.lyrics} onChange={(v) => setTrack(i, 'lyrics', v)} error={e('lyrics')} rows={4} hint="Optional." />
          </section>
        );
      })}
      <button type="button" className="btn add-track" onClick={add}>+ Add another track</button>
    </>
  );
}
