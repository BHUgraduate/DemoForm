import type { StepProps } from './types';

const ITEMS = [
  ['ownsRights', 'I confirm that I own or control the rights necessary to distribute this music.'],
  ['infoAccurate', 'I confirm that the information provided is accurate.'],
  ['authorizeProcessing', 'I authorize this platform to process this release submission.'],
] as const;

export function RightsStep({ draft, errors, update }: StepProps) {
  return (
    <>
      <p className="lede">Please confirm each declaration to continue. <em>Demo declarations — no legal rights verification takes place.</em></p>
      <div className="declarations">
        {ITEMS.map(([k, label]) => (
          <div key={k}>
            <label className={`decl ${draft.rights[k] ? 'on' : ''} ${errors[`rights.${k}`] ? 'bad' : ''}`}>
              <input type="checkbox" checked={draft.rights[k]} aria-invalid={errors[`rights.${k}`] ? true : undefined}
                onChange={(e) => update((d) => ({ ...d, rights: { ...d.rights, [k]: e.target.checked } }))} />
              <span>{label} <span className="req" aria-hidden="true">*</span></span>
            </label>
            {errors[`rights.${k}`] && <p className="err" role="alert">{errors[`rights.${k}`]}</p>}
          </div>
        ))}
      </div>
    </>
  );
}
