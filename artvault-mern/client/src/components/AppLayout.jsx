import { useEffect, useRef, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import ResponsiveNav from './ResponsiveNav';

export default function AppLayout() {
  const contentRef = useRef(null);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const update = () => setShowBackToTop(Math.max(contentRef.current?.scrollTop || 0, window.scrollY) > 320);
    const content = contentRef.current;
    content?.addEventListener('scroll', update, { passive: true });
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    update();
    return () => {
      content?.removeEventListener('scroll', update);
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, [location.pathname]);

  function backToTop() {
    const behavior = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
    contentRef.current?.scrollTo({ top: 0, behavior });
    window.scrollTo({ top: 0, behavior });
  }

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main">
        <ResponsiveNav />
        <Topbar />
        {import.meta.env.VITE_OFFLINE_READONLY === 'true' && <div className="offline-readonly-banner" role="status">Offline workspace · Browse the snapshot and save artwork metadata drafts. Live changes need online sign-in and conflict review.</div>}
        <div className="content" ref={contentRef}>
          <Outlet />
        </div>
        {showBackToTop && <button className="back-to-top" type="button" onClick={backToTop} aria-label="Back to top" title="Back to top"><span aria-hidden="true">↑</span><span>Top</span></button>}
      </div>
    </div>
  );
}
