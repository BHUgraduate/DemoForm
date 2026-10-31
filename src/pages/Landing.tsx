import { Link } from 'react-router-dom';

export default function Landing() {
  return (
    <>
      <section className="hero">
        <div className="wrap hero-in">
          <p className="eyebrow">Independent distribution · Demo</p>
          <h1>Your music,<br /><em>everywhere</em> people listen.</h1>
          <p className="hero-sub">Create your artist profile, describe your release, upload your master and artwork, and send it to our team — in one guided flow.</p>
          <div className="hero-cta">
            <Link to="/distribute" className="btn primary big">Distribute Your Music</Link>
            <Link to="/admin" className="btn big">See the admin view</Link>
          </div>
          <div className="wave" aria-hidden="true">{Array.from({ length: 48 }).map((_, i) => <span key={i} style={{ height: `${18 + Math.abs(Math.sin(i * 0.55) * 60) + (i % 5) * 4}%`, animationDelay: `${i * 40}ms` }} />)}</div>
        </div>
      </section>
      <section className="wrap steps-overview">
        <h2>How a release moves through the platform</h2>
        <ol>
          {[
            ['Profile', 'Tell us who you are and how to reach you.'],
            ['Release', 'Title, credits, genre and release date.'],
            ['Files', 'Upload your audio master and cover art.'],
            ['Stores', 'Choose the services you want to reach.'],
            ['Review', 'Confirm the details and submit to our team.'],
          ].map(([t, d], i) => (
            <li key={t}><span className="num">0{i + 1}</span><h3>{t}</h3><p>{d}</p></li>
          ))}
        </ol>
        <p className="fine">This is a working demonstration of the submission pipeline: form → API → stored record → admin review → Excel export. Store delivery, royalties and payments are not part of this demo.</p>
      </section>
    </>
  );
}
