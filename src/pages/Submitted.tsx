import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getReceipt } from '../lib/api';
import { formatDateTime } from '../lib/format';

export default function Submitted() {
  const { id = '' } = useParams();
  const [r, setR] = useState<Awaited<ReturnType<typeof getReceipt>>['submission'] | null>(null);
  const [err, setErr] = useState('');
  useEffect(() => { getReceipt(id).then((x) => setR(x.submission)).catch((e) => setErr(e.message)); }, [id]);

  return (
    <div className="wrap narrow success">
      <div className="success-mark" aria-hidden="true">✓</div>
      <p className="eyebrow">Submission received</p>
      <h1>Release Submitted</h1>
      <p className="blurb">Your release submission has been received.</p>

      {err && <div className="banner bad" role="alert">{err}</div>}
      <dl className="receipt">
        <div><dt>Submission ID</dt><dd className="mono big" data-testid="submission-id">{id}</dd></div>
        <div><dt>Status</dt><dd><span className="badge s-submitted">{r?.status ?? 'Submitted'}</span></dd></div>
        {r && <>
          <div><dt>Release</dt><dd>{r.title} <span className="muted">· {r.releaseType} by {r.artist}</span></dd></div>
          <div><dt>Received</dt><dd>{formatDateTime(r.createdAt)}</dd></div>
        </>}
      </dl>
      <p>Our team can now review your release information and prepare it for distribution.</p>
      <div className="actions left">
        <Link className="btn primary" to={`/admin/releases/${encodeURIComponent(id)}`}>View Submission</Link>
        <Link className="btn" to="/distribute" onClick={() => { /* draft was cleared on submit */ }}>Submit Another Release</Link>
      </div>
      <p className="fine">“View Submission” opens the demo admin view of this record.</p>
    </div>
  );
}
