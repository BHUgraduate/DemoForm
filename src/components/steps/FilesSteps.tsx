import { FileUpload } from '../FileUpload';
import type { StepProps } from './types';

export function AudioStep({ draft, errors, update }: StepProps) {
  return (
    <>
      <p className="lede">Upload the master for your release. For this demo one file is enough — in production each track would be uploaded and checked individually.</p>
      <FileUpload kind="audio" value={draft.audio} onChange={(audio) => update((d) => ({ ...d, audio }))} error={errors['files.audioFileId']} />
    </>
  );
}

export function ArtworkStep({ draft, errors, update }: StepProps) {
  return (
    <>
      <p className="lede">Your cover is the first thing listeners see. Use a square JPG or PNG, ideally 3000 × 3000 px, with no blurry edges or third-party logos.</p>
      <FileUpload kind="artwork" value={draft.artwork} onChange={(artwork) => update((d) => ({ ...d, artwork }))} error={errors['files.artworkFileId']} />
    </>
  );
}
