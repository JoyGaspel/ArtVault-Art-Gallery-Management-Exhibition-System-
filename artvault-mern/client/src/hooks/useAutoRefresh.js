import { useEffect, useRef } from 'react';

// Keeps read-only pages current after the API restarts or a tab regains focus.
// The callback is stored in a ref so callers do not need to memoize it.
export default function useAutoRefresh(load, intervalMs = 60000) {
  const loadRef = useRef(load);
  useEffect(() => { loadRef.current = load; }, [load]);

  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === 'visible') loadRef.current();
    };
    // Avoid reloading the entire page every time the browser regains focus;
    // the interval and explicit data-changed event keep content current.
    window.addEventListener('artvault:data-changed', refresh);
    const timer = window.setInterval(refresh, intervalMs);
    return () => {
      window.removeEventListener('artvault:data-changed', refresh);
      window.clearInterval(timer);
    };
  }, [intervalMs]);
}
