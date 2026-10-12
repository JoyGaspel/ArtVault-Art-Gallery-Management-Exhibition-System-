import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import ResponsiveNav from './ResponsiveNav';

export default function AppLayout() {
  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main">
        <ResponsiveNav />
        <Topbar />
        {import.meta.env.VITE_OFFLINE_READONLY === 'true' && <div className="offline-readonly-banner" role="status">Offline copy · Browse-only mode. Changes and sign-in are unavailable until online sync is set up.</div>}
        <div className="content">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
