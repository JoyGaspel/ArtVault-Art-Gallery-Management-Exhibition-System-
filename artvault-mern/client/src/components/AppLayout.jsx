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
        {import.meta.env.VITE_OFFLINE_READONLY === 'true' && <div className="offline-readonly-banner" role="status">Offline workspace · Browse the snapshot and save artwork metadata drafts. Live changes need online sign-in and conflict review.</div>}
        <div className="content">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
