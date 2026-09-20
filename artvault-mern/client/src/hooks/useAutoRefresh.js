import { useEffect, useRef } from 'react';

// Keeps read-only pages current after the API restarts or a tab regains focus.
// The callback is stored in a ref so callers do not need to memoize it.
export default function useAutoRefresh(load, intervalMs = 30000) {
  const loadRef = useRef(load);
  useEffect(() => { loadRef.current = load; }, [load]);

  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === 'visible') loadRef.current();
    };
    const onVisible = () => { if (document.visibilityState === 'visible') refresh(); };
    window.addEventListener('focus', refresh);
    window.addEventListener('artvault:data-changed', refresh);
    document.addEventListener('visibilitychange', onVisible);
    const timer = window.setInterval(refresh, intervalMs);
    return () => {
      window.removeEventListener('focus', refresh);
      window.removeEventListener('artvault:data-changed', refresh);
      document.removeEventListener('visibilitychange', onVisible);
      window.clearInterval(timer);
    };
  }, [intervalMs]);
}
