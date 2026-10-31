import { useId, type ReactNode } from 'react';

interface Base { label: string; error?: string; hint?: string; required?: boolean; className?: string }

function Shell({ label, error, hint, required, className, id, children }: Base & { id: string; children: ReactNode }) {
  return (
    <div className={`field ${error ? 'has-error' : ''} ${className ?? ''}`}>
      <label htmlFor={id}>{label}{required && <span className="req" aria-hidden="true"> *</span>}</label>
      {children}
      {hint && !error && <p className="hint" id={`${id}-d`}>{hint}</p>}
      {error && <p className="err" id={`${id}-d`} role="alert">{error}</p>}
    </div>
  );
}
const aria = (id: string, error?: string, hint?: string, required?: boolean) => ({
  id, 'aria-invalid': error ? true : undefined, 'aria-required': required || undefined, 'aria-describedby': error || hint ? `${id}-d` : undefined,
});

export function TextField(p: Base & {
  value: string; onChange: (v: string) => void; type?: string; placeholder?: string; autoComplete?: string;
  inputMode?: 'text' | 'tel' | 'email' | 'url' | 'numeric'; list?: string; maxLength?: number; min?: number;
}) {
  const id = useId();
  return (
    <Shell {...p} id={id}>
      <input {...aria(id, p.error, p.hint, p.required)} type={p.type ?? 'text'} value={p.value} placeholder={p.placeholder}
        autoComplete={p.autoComplete} inputMode={p.inputMode} list={p.list} maxLength={p.maxLength ?? 300} min={p.min}
        onChange={(e) => p.onChange(e.target.value)} />
    </Shell>
  );
}

export function TextArea(p: Base & { value: string; onChange: (v: string) => void; rows?: number; placeholder?: string; maxLength?: number }) {
  const id = useId();
  return (
    <Shell {...p} id={id}>
      <textarea {...aria(id, p.error, p.hint, p.required)} rows={p.rows ?? 4} value={p.value} placeholder={p.placeholder}
        maxLength={p.maxLength ?? 10000} onChange={(e) => p.onChange(e.target.value)} />
    </Shell>
  );
}

export function SelectField(p: Base & { value: string; onChange: (v: string) => void; options: readonly string[]; placeholder?: string }) {
  const id = useId();
  return (
    <Shell {...p} id={id}>
      <select {...aria(id, p.error, p.hint, p.required)} value={p.value} onChange={(e) => p.onChange(e.target.value)}>
        <option value="">{p.placeholder ?? 'Select…'}</option>
        {p.options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </Shell>
  );
}

/** Accessible segmented radio group (Yes/No, release type, …). Arrow keys work natively. */
export function Segmented(p: Base & { name: string; value: string; onChange: (v: string) => void; options: readonly string[] }) {
  const id = useId();
  return (
    <div className={`field ${p.error ? 'has-error' : ''} ${p.className ?? ''}`}>
      <span className="label" id={`${id}-l`}>{p.label}{p.required && <span className="req" aria-hidden="true"> *</span>}</span>
      <div className="segmented" role="radiogroup" aria-labelledby={`${id}-l`} aria-describedby={p.error || p.hint ? `${id}-d` : undefined}>
        {p.options.map((o, i) => (
          <label key={o} className={p.value === o ? 'on' : ''}>
            <input type="radio" name={`${p.name}-${id}`} value={o} checked={p.value === o} onChange={() => p.onChange(o)}
              aria-invalid={p.error && i === 0 ? true : undefined} />
            <span>{o}</span>
          </label>
        ))}
      </div>
      {p.hint && !p.error && <p className="hint" id={`${id}-d`}>{p.hint}</p>}
      {p.error && <p className="err" id={`${id}-d`} role="alert">{p.error}</p>}
    </div>
  );
}
