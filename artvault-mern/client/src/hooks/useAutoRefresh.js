import { useEffect, useRef } from 'react';

// Refresh visible data without reloading the page. Callers should pass a
// silent load so background checks do not replace content with a spinner.
export default function useAutoRefresh(load, intervalMs = 30000) {
  const loadRef = useRef(load);
  loadRef.current = load;

  useEffect(() => {
    let lastRefresh = Date.now();
    let changeTimer;
    const refresh = () => {
      if (document.visibilityState !== 'visible') return;
      const now = Date.now();
      if (now - lastRefresh < 3000) return;
      lastRefresh = now;
      loadRef.current();
    };
    const dataChanged = () => {
      window.clearTimeout(changeTimer);
      changeTimer = window.setTimeout(() => {
        lastRefresh = 0;
        refresh();
      }, 300);
    };
    const storageChanged = (event) => {
      if (event.key === 'artvault:data-version') dataChanged();
    };
    window.addEventListener('artvault:data-changed', dataChanged);
    window.addEventListener('storage', storageChanged);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    const timer = window.setInterval(refresh, intervalMs);
    return () => {
      window.removeEventListener('artvault:data-changed', dataChanged);
      window.removeEventListener('storage', storageChanged);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
      window.clearTimeout(changeTimer);
      window.clearInterval(timer);
    };
  }, [intervalMs]);
}
