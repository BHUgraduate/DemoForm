import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { artistSchema, releaseSchema, releaseSubmissionSchema, rightsSchema, storesSchema, tracksSchema } from '../../shared/schema';
import { ApiError, submitRelease } from '../lib/api';
import { clearDraft, emptyDraft, loadDraft, saveDraft, toPayload, type Draft } from '../lib/draft';
import { validate, type Errors } from '../lib/validate';
import { ArtistStep } from '../components/steps/ArtistStep';
import { ReleaseStep } from '../components/steps/ReleaseStep';
import { TracksStep } from '../components/steps/TracksStep';
import { ArtworkStep, AudioStep } from '../components/steps/FilesSteps';
import { StoresStep } from '../components/steps/StoresStep';
import { RightsStep } from '../components/steps/RightsStep';
import { ReviewStep } from '../components/steps/ReviewStep';

const STEPS = [
  { label: 'Artist', title: 'Create your artist profile', blurb: 'Tell us who you are. This is how we reach you about your release.' },
  { label: 'Release', title: 'Release information', blurb: 'The essentials: what you are releasing, and who made it.' },
  { label: 'Tracks', title: 'Track information', blurb: 'Add every track on this release.' },
  { label: 'Music', title: 'Upload your music', blurb: 'High-quality audio only.' },
  { label: 'Artwork', title: 'Upload cover art', blurb: 'Make a first impression.' },
  { label: 'Stores', title: 'Choose your stores', blurb: 'Where should listeners find you?' },
  { label: 'Rights', title: 'Rights & declarations', blurb: 'A few confirmations before we can process your release.' },
  { label: 'Review', title: 'Review & submit', blurb: '' },
] as const;
const LAST = STEPS.length - 1;

function stepErrors(d: Draft, step: number): Errors {
  switch (step) {
    case 0: return validate(artistSchema, d.artist, 'artist');
    case 1: return validate(releaseSchema, d.release, 'release');
    case 2: return validate(tracksSchema, d.tracks, 'tracks');
    case 3: return d.audio ? {} : { 'files.audioFileId': 'Please upload your audio file to continue.' };
    case 4: return d.artwork ? {} : { 'files.artworkFileId': 'Please upload your cover artwork to continue.' };
    case 5: return validate(storesSchema, d.stores, 'stores');
    case 6: return validate(rightsSchema, d.rights, 'rights');
    default: return {};
  }
}

/** Which wizard step owns a server-reported field path. */
function stepOfPath(path: string): number {
  if (path.startsWith('artist')) return 0;
  if (path.startsWith('release')) return 1;
  if (path.startsWith('tracks')) return 2;
  if (path === 'files.audioFileId') return 3;
  if (path === 'files.artworkFileId') return 4;
  if (path.startsWith('stores')) return 5;
  if (path.startsWith('rights')) return 6;
  return LAST;
}

export default function Distribute() {
  const nav = useNavigate();
  const restored = useMemo(loadDraft, []);
  const [draft, setDraft] = useState<Draft>(restored?.draft ?? emptyDraft());
  const [step, setStep] = useState(Math.min(restored?.step ?? 0, LAST));
  const [errors, setErrors] = useState<Errors>({});
  const [showRestored, setShowRestored] = useState(!!restored && restored.step > 0);
  const [submitting, setSubmitting] = useState(false);
  const [banner, setBanner] = useState('');
  const heading = useRef<HTMLHeadingElement>(null);
  const firstRender = useRef(true);

  useEffect(() => { saveDraft(draft, step); }, [draft, step]);
  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return; }
    heading.current?.focus();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [step]);

  const update = (fn: (d: Draft) => Draft) => {
    setDraft(fn);
    setBanner('');
    setErrors((e) => (Object.keys(e).length ? {} : e)); // stale errors are cleared on edit; re-validated on Continue
  };

  const focusFirstError = () => setTimeout(() => {
    const el = document.querySelector<HTMLElement>('[aria-invalid="true"]');
    el?.focus(); el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, 50);

  function next() {
    const errs = stepErrors(draft, step);
    if (Object.keys(errs).length) { setErrors(errs); setBanner('Please fix the highlighted fields to continue.'); focusFirstError(); return; }
    setErrors({}); setBanner('');
    if (step === 1) {
      // convenience: seed empty track fields from the release so artists don't retype them
      setDraft((d) => ({ ...d, tracks: d.tracks.map((t) => ({
        ...t, primaryArtist: t.primaryArtist || d.release.primaryArtist, language: t.language || d.release.language, explicit: t.explicit || d.release.explicit,
      })) }));
    }
    setStep((s) => Math.min(s + 1, LAST));
  }
  const back = () => { setErrors({}); setBanner(''); setStep((s) => Math.max(s - 1, 0)); };
  const goTo = (n: number) => { setErrors({}); setBanner(''); setStep(n); };

  const errorSteps = useMemo(() => (step === LAST ? [0, 1, 2, 3, 4, 5, 6].filter((s) => Object.keys(stepErrors(draft, s)).length) : []), [draft, step]);

  async function submit() {
    if (errorSteps.length) { setBanner('Some sections are incomplete — use Edit to fix them.'); return; }
    setSubmitting(true); setBanner('');
    try {
      const res = await submitRelease(toPayload(draft));
      clearDraft();
      nav(`/submitted/${res.submissionId}`, { replace: true });
    } catch (e) {
      if (e instanceof ApiError && e.fieldErrors && Object.keys(e.fieldErrors).length) {
        const first = Math.min(...Object.keys(e.fieldErrors).map(stepOfPath));
        setErrors(e.fieldErrors); setStep(first);
        setBanner('The server found some problems with your submission. Please review the highlighted fields.');
        focusFirstError();
      } else {
        setBanner(e instanceof ApiError ? e.message : 'Something went wrong. Please try again.');
      }
    } finally { setSubmitting(false); }
  }

  function startOver() {
    if (!window.confirm('Clear everything and start a new release?')) return;
    clearDraft(); setDraft(emptyDraft()); setErrors({}); setStep(0); setShowRestored(false); setBanner('');
  }

  const props = { draft, errors, update };
  const S = STEPS[step];
  // validate the parsed whole just to be sure the Submit button reflects server rules too
  const canSubmit = errorSteps.length === 0 && releaseSubmissionSchema.safeParse(toPayload(draft)).success;

  return (
    <div className="wrap wizard">
      <nav className="stepper" aria-label="Progress">
        <p className="stepper-mobile"><strong>Step {step + 1} of {STEPS.length}</strong> · {S.label}</p>
        <ol>
          {STEPS.map((s, i) => (
            <li key={s.label} className={i === step ? 'current' : i < step ? 'done' : ''} aria-current={i === step ? 'step' : undefined}>
              <button type="button" disabled={i > step} onClick={() => goTo(i)} aria-label={`${s.label}${i < step ? ' (completed)' : ''}`}>
                <span className="dot">{i < step ? '✓' : i + 1}</span><span className="lab">{s.label}</span>
              </button>
            </li>
          ))}
        </ol>
        <div className="bar" aria-hidden="true"><span style={{ width: `${(step / LAST) * 100}%` }} /></div>
      </nav>

      {showRestored && (
        <div className="banner info">Welcome back — we restored your draft from this browser. <button type="button" className="link" onClick={startOver}>Start over</button>
          <button type="button" className="x" aria-label="Dismiss" onClick={() => setShowRestored(false)}>×</button></div>
      )}

      <section className="panel" key={step} aria-labelledby="step-title">
        <header className="panel-head">
          <p className="eyebrow">Step {step + 1} · {S.label}</p>
          <h1 id="step-title" ref={heading} tabIndex={-1}>{S.title}</h1>
          {S.blurb && <p className="blurb">{S.blurb}</p>}
        </header>
        {banner && <div className="banner bad" role="alert">{banner}</div>}
        <form onSubmit={(e) => { e.preventDefault(); step === LAST ? submit() : next(); }} noValidate>
          {step === 0 && <ArtistStep {...props} />}
          {step === 1 && <ReleaseStep {...props} />}
          {step === 2 && <TracksStep {...props} />}
          {step === 3 && <AudioStep {...props} />}
          {step === 4 && <ArtworkStep {...props} />}
          {step === 5 && <StoresStep {...props} />}
          {step === 6 && <RightsStep {...props} />}
          {step === 7 && <ReviewStep draft={draft} goTo={goTo} errorSteps={errorSteps} />}
          <div className="actions">
            <button type="button" className="btn" onClick={back} disabled={step === 0 || submitting}>← Back</button>
            <span className="spacer" />
            {step < LAST
              ? <button type="submit" className="btn primary">Continue →</button>
              : <button type="submit" className="btn primary big" disabled={submitting || !canSubmit}>{submitting ? 'Submitting…' : 'Submit Release'}</button>}
          </div>
        </form>
      </section>
      <p className="autosave">Draft saved in this browser · <button type="button" className="link" onClick={startOver}>Clear draft</button></p>
    </div>
  );
}
