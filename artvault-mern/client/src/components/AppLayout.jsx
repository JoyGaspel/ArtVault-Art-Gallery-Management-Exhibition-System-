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
        <div className="content">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
