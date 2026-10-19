import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import { useToast } from '../components/Toast';
import PageLoadState from '../components/PageLoadState';
import useAutoRefresh from '../hooks/useAutoRefresh';

export default function RemovedArtworks() {
  const toast = useToast();
  const [artworks, setArtworks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [restoringId, setRestoringId] = useState(null);

  const load = useCallback(({ silent = false } = {}) => {
    if (!silent) { setLoading(true); setError(''); }
    return api.get('/archives/mine/artworks')
      .then(({ data }) => { setArtworks(data.artworks || []); setError(''); })
      .catch((err) => { if (!silent) setError(err.response?.data?.message || 'Could not load removed artworks.'); })
      .finally(() => { if (!silent) setLoading(false); });
  }, []);

  useEffect(() => { load(); }, [load]);
  useAutoRefresh(() => load({ silent: true }));

  async function restore(archiveId) {
    if (restoringId) return;
    setRestoringId(archiveId);
    try {
      await api.post(`/archives/mine/artworks/${archiveId}/restore`);
      setArtworks((current) => current.filter((item) => item.archiveId !== archiveId));
      window.dispatchEvent(new Event('artvault:notifications-changed'));
      toast('Artwork restored to your original Public or Vault location.');
      load({ silent: true });
    } catch (err) {
      toast(err.response?.data?.message || 'Could not restore this artwork.', true);
      load({ silent: true });
    } finally { setRestoringId(null); }
  }

  return <section className="removed-artworks-page">
    <div className="page-head collection-page-head"><div>
      <div className="eyebrow">MY STUDIO · RECOVERY</div>
      <h1>Recently removed artworks</h1>
      <div className="sub">Changed your mind? Restore a removed artwork here within 30 days. It will return to its original Public or Vault setting. Previous exhibit placements and likes will not return.</div>
    </div><Link className="btn btn-ghost" to="/my-artworks">My artworks</Link></div>

    {loading ? <PageLoadState loading label="removed artworks" />
      : error ? <PageLoadState error={error} onRetry={load} />
        : artworks.length === 0 ? <div className="empty">No artworks are in your 30-day recovery area.</div>
          : <div className="removed-artworks-list">{artworks.map((artwork) => <article className="removed-artwork-card" key={artwork.archiveId}>
            <div className="removed-artwork-details">
              <span className="eyebrow">{artwork.visibility === 'private' ? 'In Vault before removal' : 'Public before removal'}</span>
              <h2>{artwork.title}</h2>
              <p>{(artwork.categories || []).join(' · ') || 'No categories'} · Removed {new Date(artwork.deletedAt).toLocaleDateString()}</p>
              <p className="removed-artwork-deadline">Restore before {new Date(artwork.recoverUntil).toLocaleString()}</p>
            </div>
            <button className="btn btn-primary" type="button" disabled={Boolean(restoringId)} onClick={() => restore(artwork.archiveId)}>{restoringId === artwork.archiveId ? 'Restoring…' : 'Restore artwork'}</button>
          </article>)}</div>}
  </section>;
}
