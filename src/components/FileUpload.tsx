import { useEffect, useRef, useState } from 'react';
import { uploadFile, ApiError } from '../lib/api';
import { formatBytes } from '../lib/format';
import type { UploadedMeta } from '../lib/draft';

interface Props {
  kind: 'audio' | 'artwork';
  value: UploadedMeta | null;
  onChange: (v: UploadedMeta | null) => void;
  error?: string;
}

const CFG = {
  audio: { exts: ['mp3', 'wav', 'flac'], accept: '.mp3,.wav,.flac,audio/mpeg,audio/wav,audio/flac', max: 50 * 1024 * 1024, noun: 'audio file', formats: 'MP3, WAV or FLAC' },
  artwork: { exts: ['jpg', 'jpeg', 'png'], accept: '.jpg,.jpeg,.png,image/jpeg,image/png', max: 10 * 1024 * 1024, noun: 'cover artwork', formats: 'JPG or PNG' },
};

export function FileUpload({ kind, value, onChange, error }: Props) {
  const cfg = CFG[kind];
  const input = useRef<HTMLInputElement>(null);
  const abort = useRef<AbortController | null>(null);
  const [drag, setDrag] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [localName, setLocalName] = useState('');
  const [localErr, setLocalErr] = useState('');
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => () => { abort.current?.abort(); }, []);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  async function handle(file: File | undefined) {
    if (!file) return;
    setLocalErr('');
    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
    if (!cfg.exts.includes(ext)) return setLocalErr(`"${file.name}" isn't supported. Please choose ${cfg.formats}.`);
    if (file.size === 0) return setLocalErr('That file is empty.');
    if (file.size > cfg.max) return setLocalErr(`That file is ${formatBytes(file.size)}. The maximum is ${formatBytes(cfg.max)}.`);

    setLocalName(file.name);
    setProgress(0);
    if (kind === 'artwork') setPreview(URL.createObjectURL(file));
    abort.current = new AbortController();
    try {
      const meta = await uploadFile(kind, file, setProgress, abort.current.signal);
      onChange(meta);
    } catch (e) {
      if (kind === 'artwork') setPreview(null);
      setLocalErr(e instanceof ApiError ? e.message : 'The upload failed. Please try again.');
    } finally {
      setProgress(null);
      if (input.current) input.current.value = '';
    }
  }

  const uploading = progress !== null;
  const shownErr = localErr || error;

  return (
    <div className="upload">
      <input ref={input} type="file" hidden accept={cfg.accept} onChange={(e) => handle(e.target.files?.[0])} aria-label={`Choose ${cfg.noun}`} />

      {value && !uploading ? (
        <div className="file-card" aria-live="polite">
          {kind === 'artwork' && (
            preview ? <img src={preview} alt="Cover artwork preview" className="cover-preview" /> : <div className="cover-preview placeholder" aria-hidden="true">♪</div>
          )}
          {kind === 'audio' && <div className="file-icon" aria-hidden="true">♫</div>}
          <div className="file-meta">
            <p className="file-name">{value.originalName}</p>
            <p className="file-sub">
              {formatBytes(value.size)}
              {kind === 'artwork' && value.width && ` · ${value.width} × ${value.height} px`}
              {' · '}{value.mimeType}
            </p>
            {kind === 'artwork' && value.width && Math.min(value.width, value.height ?? 0) < 1400 && (
              <p className="warn-text">Streaming services recommend at least 1400 × 1400 px. (Demo: allowed.)</p>
            )}
            <p className="ok-text">✓ Uploaded to the server</p>
            <div className="file-actions">
              <button type="button" className="btn small" onClick={() => input.current?.click()}>Replace</button>
              <button type="button" className="btn small ghost" onClick={() => { onChange(null); setPreview(null); setLocalErr(''); }}>Remove</button>
            </div>
          </div>
        </div>
      ) : uploading ? (
        <div className="file-card" role="status" aria-live="polite">
          {kind === 'artwork' && preview && <img src={preview} alt="" className="cover-preview" />}
          <div className="file-meta">
            <p className="file-name">{localName}</p>
            <div className="progress" role="progressbar" aria-valuenow={progress ?? 0} aria-valuemin={0} aria-valuemax={100} aria-label="Upload progress">
              <span style={{ width: `${progress}%` }} />
            </div>
            <p className="file-sub">Uploading… {progress}%</p>
            <div className="file-actions"><button type="button" className="btn small ghost" onClick={() => abort.current?.abort()}>Cancel</button></div>
          </div>
        </div>
      ) : (
        <div
          className={`dropzone ${drag ? 'drag' : ''} ${shownErr ? 'bad' : ''}`}
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); handle(e.dataTransfer.files?.[0]); }}
        >
          <div className="dz-icon" aria-hidden="true">{kind === 'audio' ? '♫' : '▣'}</div>
          <p className="dz-title">Drag &amp; drop your {cfg.noun}</p>
          <p className="dz-sub">{cfg.formats} · up to {formatBytes(cfg.max)}{kind === 'artwork' ? ' · square, 3000 × 3000 px ideal' : ''}</p>
          <button type="button" className="btn" onClick={() => input.current?.click()} aria-invalid={error ? true : undefined}>Browse files</button>
        </div>
      )}
      {shownErr && <p className="err" role="alert">{shownErr}</p>}
    </div>
  );
}
