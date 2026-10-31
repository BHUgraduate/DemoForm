import { BrowserRouter, Route, Routes, Link } from 'react-router-dom';
import { SiteLayout } from './components/Layout';
import Landing from './pages/Landing';
import Distribute from './pages/Distribute';
import Submitted from './pages/Submitted';
import AdminLayout from './pages/admin/AdminLayout';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminDetail from './pages/admin/AdminDetail';

export default function App() {
  return (
    <BrowserRouter>
      <a href="#main" className="skip">Skip to content</a>
      <Routes>
        <Route element={<SiteLayout />}>
          <Route index element={<Landing />} />
          <Route path="distribute" element={<Distribute />} />
          <Route path="submitted/:id" element={<Submitted />} />
          <Route path="admin" element={<AdminLayout />}>
            <Route index element={<AdminDashboard />} />
            <Route path="releases/:id" element={<AdminDetail />} />
          </Route>
          <Route path="*" element={<div className="wrap narrow"><h1>Page not found</h1><Link to="/" className="btn">Go home</Link></div>} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
