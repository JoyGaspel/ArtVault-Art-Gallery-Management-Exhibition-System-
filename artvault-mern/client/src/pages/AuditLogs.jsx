import { useEffect, useState } from 'react';
import api from '../api';
import useAutoRefresh from '../hooks/useAutoRefresh';
import { useAuth } from '../context/AuthContext';

export default function AuditLogs() {
  const { user } = useAuth();
  const isSubAdmin = user?.role === 'sub_admin';
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  function load() {
    setLoading(true); setError('');
    return api.get('/audit-logs?limit=100').then((res) => setLogs(res.data.logs || []))
      .catch((err) => setError(err.response?.data?.message || 'Could not load activity logs.'))
      .finally(() => setLoading(false));
  }
  useEffect(() => { load(); }, []);
  useAutoRefresh(load);
  return <section><div className="page-head"><div><div className="eyebrow">Administration · Audit</div><h1>{isSubAdmin ? 'Artist activity' : 'Activity logs'}</h1><div className="sub">{isSubAdmin ? 'Review activity from artist accounts.' : 'Review account and content changes.'}</div></div></div>
    {loading && <div className="empty">Loading activity...</div>}
    {!loading && error && <div className="empty">{error}</div>}
    {!loading && !error && !logs.length && <div className="empty">No activity recorded yet.</div>}
    {!loading && !error && logs.length > 0 && <div className="admin-list">{logs.map((log) => <article className="admin-artist-card" key={log._id}><div className="admin-artist-info"><h2>{log.action.replace(/_/g, ' ')}</h2><div className="mono admin-artist-email">{log.actor?.name || 'Unknown account'} · {log.entityType} · {new Date(log.createdAt).toLocaleString()}</div><div>{log.details ? JSON.stringify(log.details) : ''}</div></div></article>)}</div>}
  </section>;
}
