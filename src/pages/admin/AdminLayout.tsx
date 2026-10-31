import { Outlet } from 'react-router-dom';

export default function AdminLayout() {
  return (
    <>
      <div className="demo-banner" role="note">
        <strong>DEMO ADMIN AREA</strong> — no login is required and this is not production-secure. A real deployment would put this behind authentication, roles and audit logging.
      </div>
      <Outlet />
    </>
  );
}
