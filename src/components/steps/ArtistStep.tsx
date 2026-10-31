import { ARTIST_TYPES } from '../../../shared/schema';
import { SelectField, TextField } from '../Field';
import type { StepProps } from './types';

const COUNTRIES = ['India', 'United States', 'United Kingdom', 'Canada', 'Australia', 'Germany', 'France', 'Spain', 'Italy', 'Netherlands', 'Brazil', 'Mexico', 'Japan', 'South Korea', 'Singapore', 'United Arab Emirates', 'Nigeria', 'South Africa', 'Pakistan', 'Bangladesh', 'Sri Lanka', 'Nepal', 'New Zealand', 'Ireland', 'Sweden'];

export function ArtistStep({ draft, errors, update }: StepProps) {
  const a = draft.artist;
  const set = (k: keyof typeof a) => (v: string) => update((d) => ({ ...d, artist: { ...d.artist, [k]: v } }));
  return (
    <>
      <div className="grid-2">
        <TextField label="Artist / legal name" required value={a.legalName} onChange={set('legalName')} error={errors['artist.legalName']} autoComplete="name" hint="As it appears on your ID — used for contracts, never shown to fans." />
        <TextField label="Artist display name" required value={a.displayName} onChange={set('displayName')} error={errors['artist.displayName']} hint="The name listeners will see on streaming services." />
        <TextField label="Email" required type="email" inputMode="email" autoComplete="email" value={a.email} onChange={set('email')} error={errors['artist.email']} placeholder="artist@example.com" />
        <TextField label="Phone number" required type="tel" inputMode="tel" autoComplete="tel" value={a.phone} onChange={set('phone')} error={errors['artist.phone']} placeholder="+1 555 010 0100" />
        <TextField label="Country" required list="countries" autoComplete="country-name" value={a.country} onChange={set('country')} error={errors['artist.country']} />
        <datalist id="countries">{COUNTRIES.map((c) => <option key={c} value={c} />)}</datalist>
        <SelectField label="Artist type" required value={a.artistType} onChange={set('artistType')} options={ARTIST_TYPES} error={errors['artist.artistType']} placeholder="Choose one…" />
        <TextField label="State / region" value={a.state} onChange={set('state')} error={errors['artist.state']} autoComplete="address-level1" />
        <TextField label="City" value={a.city} onChange={set('city')} error={errors['artist.city']} autoComplete="address-level2" />
      </div>
      <h3 className="subhead">Online presence <span className="optional">optional</span></h3>
      <div className="grid-2">
        <TextField label="Instagram" value={a.instagram} onChange={set('instagram')} placeholder="@yourhandle" error={errors['artist.instagram']} />
        <TextField label="YouTube" type="url" inputMode="url" value={a.youtube} onChange={set('youtube')} placeholder="https://youtube.com/@…" error={errors['artist.youtube']} />
        <TextField label="Spotify artist URL" type="url" inputMode="url" value={a.spotifyUrl} onChange={set('spotifyUrl')} placeholder="https://open.spotify.com/artist/…" error={errors['artist.spotifyUrl']} />
        <TextField label="Apple Music artist URL" type="url" inputMode="url" value={a.appleMusicUrl} onChange={set('appleMusicUrl')} placeholder="https://music.apple.com/…" error={errors['artist.appleMusicUrl']} />
      </div>
    </>
  );
}
