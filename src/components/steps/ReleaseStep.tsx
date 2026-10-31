import { GENRES, LANGUAGES, RELEASE_TYPES } from '../../../shared/schema';
import { SelectField, Segmented, TextField } from '../Field';
import type { StepProps } from './types';

const YN = ['Yes', 'No'] as const;

export function ReleaseStep({ draft, errors, update }: StepProps) {
  const r = draft.release;
  const e = (k: string) => errors[`release.${k}`];
  const set = (k: keyof typeof r) => (v: string) => update((d) => ({ ...d, release: { ...d.release, [k]: v } }));
  return (
    <>
      <Segmented label="Release type" name="releaseType" required value={r.releaseType} onChange={set('releaseType')} options={RELEASE_TYPES} error={e('releaseType')}
        hint="Single: 1–3 tracks · EP: 4–6 tracks · Album: 7+ tracks" />
      <div className="grid-2">
        <TextField label="Release title" required value={r.title} onChange={set('title')} error={e('title')} />
        <TextField label="Primary artist" required value={r.primaryArtist} onChange={set('primaryArtist')} error={e('primaryArtist')} hint={draft.artist.displayName && !r.primaryArtist ? `Tip: use “${draft.artist.displayName}”` : undefined} />
        <TextField label="Featuring artist(s)" value={r.featuringArtists} onChange={set('featuringArtists')} error={e('featuringArtists')} hint="Separate multiple names with commas." />
        <TextField label="Release date" required type="date" value={r.releaseDate} onChange={set('releaseDate')} error={e('releaseDate')} />
        <SelectField label="Genre" required value={r.genre} onChange={set('genre')} options={GENRES} error={e('genre')} />
        <TextField label="Subgenre" value={r.subgenre} onChange={set('subgenre')} error={e('subgenre')} />
        <SelectField label="Language" required value={r.language} onChange={set('language')} options={LANGUAGES} error={e('language')} />
        <Segmented label="Explicit content" name="explicit" required value={r.explicit} onChange={set('explicit')} options={YN} error={e('explicit')} />
        <Segmented label="Original release?" name="originalRelease" required value={r.originalRelease} onChange={set('originalRelease')} options={YN} error={e('originalRelease')} hint="“No” for covers or public-domain works." />
        <Segmented label="Previously released?" name="previouslyReleased" required value={r.previouslyReleased} onChange={set('previouslyReleased')} options={YN} error={e('previouslyReleased')} />
      </div>
      {r.previouslyReleased === 'Yes' && (
        <div className="grid-2 reveal">
          <TextField label="Previous release date" required type="date" value={r.previousReleaseDate} onChange={set('previousReleaseDate')} error={e('previousReleaseDate')} />
          <TextField label="Existing UPC / ISRC" value={r.upc} onChange={set('upc')} error={e('upc')} hint="If you have one." />
        </div>
      )}
      <h3 className="subhead">Credits &amp; rights</h3>
      <div className="grid-2">
        <TextField label="Songwriter(s)" required value={r.songwriters} onChange={set('songwriters')} error={e('songwriters')} />
        <TextField label="Composer(s)" required value={r.composers} onChange={set('composers')} error={e('composers')} />
        <TextField label="Lyricist(s)" value={r.lyricists} onChange={set('lyricists')} error={e('lyricists')} />
        <TextField label="Producer(s)" value={r.producers} onChange={set('producers')} error={e('producers')} />
        <TextField label="Copyright owner" required value={r.copyrightOwner} onChange={set('copyrightOwner')} error={e('copyrightOwner')} hint="Person or company that owns the master and composition." />
        <TextField label="Publishing information" value={r.publishingInfo} onChange={set('publishingInfo')} error={e('publishingInfo')} hint="Publisher / PRO affiliation, if any." />
      </div>
    </>
  );
}
