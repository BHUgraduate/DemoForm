import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../lib/auth';

/** Signed-in users only. Everyone else is sent to /login and returned here afterwards. */
export function RequireAuth() {
  const { user, loading } = useAuth();
  const loc = useLocation();
  if (loading) return <div className="wrap narrow"><p>Loading…</p></div>;
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(loc.pathname)}`} replace />;
  return <Outlet />;
}

export function RequireAdmin() {
  const { user, loading } = useAuth();
  const loc = useLocation();
  if (loading) return <div className="wrap narrow"><p>Loading…</p></div>;
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(loc.pathname)}`} replace />;
  if (user.role !== 'admin') {
    return (
      <div className="wrap narrow">
        <h1>Administrators only</h1>
        <p className="blurb">You're signed in as {user.email}, which doesn't have admin access.</p>
      </div>
    );
  }
  return <Outlet />;
}
