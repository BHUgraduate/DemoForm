import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';

export function Logo() {
  return (
    <Link to="/" className="logo" aria-label="Soundlane home">
      <svg width="26" height="26" viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="8" fill="currentColor" /><path d="M8 20c3-8 5-8 8 0s5 8 8 0" fill="none" stroke="#ff5b2e" strokeWidth="3" strokeLinecap="round" /></svg>
      <span>Soundlane</span>
    </Link>
  );
}

export function SiteLayout() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  return (
    <>
      <header className="topbar">
        <div className="wrap topbar-in">
          <Logo />
          <nav aria-label="Primary">
            {user?.role !== 'admin' && <NavLink to="/distribute">Distribute</NavLink>}
            {user && user.role !== 'admin' && <NavLink to="/dashboard">My Releases</NavLink>}
            {user?.role === 'admin' && <NavLink to="/admin" className="admin-link">Admin <span className="pill">demo</span></NavLink>}
            {user
              ? <button type="button" className="navbtn" onClick={async () => { await logout(); nav('/'); }}>Sign out</button>
              : <NavLink to="/login">Sign in</NavLink>}
          </nav>
        </div>
      </header>
      <main id="main"><Outlet /></main>
      <footer className="footer">
        <div className="wrap">
          <p><strong>Soundlane</strong> is a fictional product used for a client demonstration. No music is actually distributed and no payments are processed.</p>
        </div>
      </footer>
    </>
  );
}
