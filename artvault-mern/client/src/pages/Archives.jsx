import { useEffect, useState } from 'react';
import api from '../api';
import { useToast } from '../components/Toast';
import ConfirmDialog from '../components/ConfirmDialog';

export default function Archives() {
  const toast = useToast();
  const [archives, setArchives] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(null);
  const [filter, setFilter] = useState('all');
  const load = () => {
    setLoading(true); setError('');
    return api.get('/archives').then((r) => setArchives(Array.isArray(r.data?.archives) ? r.data.archives : []))
      .catch((e) => { const message = e.response?.data?.message || 'Could not load archives. Restart the server and try again.'; setError(message); toast(message, true); })
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);
  const visible = filter === 'all' ? archives : archives.filter((item) => item.entityType === filter);
  const count = (type) => archives.filter((item) => item.entityType === type).length;
  async function restore(item) { try { await api.post(`/archives/${item._id}/restore`); toast('Item restored.'); load(); } catch (e) { toast(e.response?.data?.message || 'Could not restore item.', true); } }
  async function purge() { const item = pending; setPending(null); if (!item) return; try { await api.delete(`/archives/${item._id}`); toast('Permanently deleted.'); load(); } catch (e) { toast(e.response?.data?.message || 'Could not permanently delete item.', true); } }
  return <section><div className="page-head"><div><div className="eyebrow">Administration · Recovery</div><h1>Archives</h1><div className="sub">Deleted items are held here until permanently removed.</div></div></div>
    <div className="stat-row archive-categories">
      {[['all', 'All archived items', archives.length], ['artist', 'Artist accounts', count('artist')], ['artwork', 'Artworks', count('artwork')], ['exhibit', 'Exhibits', count('exhibit')]].map(([key, label, total]) => <button key={key} type="button" className={`stat-box archive-category${filter === key ? ' selected' : ''}`} onClick={() => setFilter(key)}><div className="num">{total}</div><div className="lbl">{label}</div></button>)}
    </div>
    {loading && <div className="empty">Loading archives...</div>}
    {!loading && error && <div className="empty"><p>{error}</p><button className="btn btn-primary" onClick={load}>Retry</button></div>}
    {!loading && !error && !archives.length && <div className="empty">Archives are empty.</div>}
    {!loading && !error && archives.length > 0 && !visible.length && <div className="empty">No {filter} items in Archives.</div>}
    {!loading && !error && visible.length > 0 && <div className="admin-list">{visible.map((item) => <article className="admin-artist-card" key={item._id}><div className="admin-artist-info"><h2>{item.snapshot?.name || item.snapshot?.title || 'Archived item'}</h2><div className="mono admin-artist-email">{item.entityType === 'artist' ? 'Artist account' : item.entityType === 'artwork' ? 'Artwork' : 'Exhibit'} · {item.deletedAt ? new Date(item.deletedAt).toLocaleString() : 'Archived item'}</div></div><div className="exhibit-row-actions"><button className="btn btn-ghost btn-sm" onClick={() => restore(item)}>Restore</button><button className="btn btn-danger btn-sm" onClick={() => setPending(item)}>Delete forever</button></div></article>)}</div>}
    {pending && <ConfirmDialog title="Delete permanently?" message="This archived item cannot be recovered after permanent deletion." confirmLabel="Delete forever" danger onConfirm={purge} onCancel={() => setPending(null)} />}
  </section>;
}
