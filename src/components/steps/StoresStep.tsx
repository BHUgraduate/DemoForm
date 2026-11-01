import { STORES } from '../../../shared/schema';
import { TextField } from '../Field';
import type { StepProps } from './types';

const MARK: Record<string, string> = { Spotify: 'Sp', 'Apple Music': 'Ap', 'YouTube Music': 'Yt', 'Amazon Music': 'Am', Deezer: 'Dz', TikTok: 'Tt', 'Instagram / Meta': 'Ig', Tidal: 'Td', Pandora: 'Pa' };

export function StoresStep({ draft, errors, update }: StepProps) {
  const all = draft.stores.length === STORES.length;
  const toggle = (s: (typeof STORES)[number]) =>
    update((d) => ({ ...d, stores: d.stores.includes(s) ? d.stores.filter((x) => x !== s) : STORES.filter((x) => x === s || d.stores.includes(x)) }));
  return (
    <>
      <p className="lede">Choose where you'd like this release to appear. <em>Demo only — selections are saved with the submission, but nothing is sent to these services.</em></p>
      <label className="select-all">
        <input type="checkbox" checked={all} onChange={() => update((d) => ({ ...d, stores: all ? [] : [...STORES] }))} />
        <span>Select all stores</span>
        <span className="count">{draft.stores.length} of {STORES.length} selected</span>
      </label>
      <div className="store-grid" role="group" aria-label="Distribution stores">
        {STORES.map((s) => {
          const on = draft.stores.includes(s);
          return (
            <label key={s} className={`store ${on ? 'on' : ''}`}>
              <input type="checkbox" checked={on} onChange={() => toggle(s)} />
              <span className="store-mark" aria-hidden="true">{MARK[s]}</span>
              <span className="store-name">{s}</span>
              <span className="tick" aria-hidden="true">{on ? '✓' : ''}</span>
            </label>
          );
        })}
      </div>
      {errors['stores'] && <p className="err" role="alert">{errors['stores']}</p>}
      <div style={{ marginTop: 24 }}>
        <TextField label="Other platforms" value={draft.otherPlatforms} onChange={(v) => update((d) => ({ ...d, otherPlatforms: v }))} error={errors['otherPlatforms']} hint="Optional — anything not listed above (e.g. regional services)." maxLength={200} />
      </div>
    </>
  );
}
