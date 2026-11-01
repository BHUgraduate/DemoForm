import { Outlet } from 'react-router-dom';

export default function AdminLayout() {
  return (
    <>
      <div className="demo-banner" role="note">
        <strong>DEMO ADMIN AREA</strong> — demo-grade login only (no MFA, audit log or per-admin permissions). Not production-hardened.
      </div>
      <Outlet />
    </>
  );
}
