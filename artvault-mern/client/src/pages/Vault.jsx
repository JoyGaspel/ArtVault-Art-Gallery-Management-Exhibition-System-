import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import ArtworkThumbnail from '../components/ArtworkThumbnail';
import ArtworkCardDetails from '../components/ArtworkCardDetails';
import PageLoadState from '../components/PageLoadState';
import ConfirmDialog from '../components/ConfirmDialog';
import useAutoRefresh from '../hooks/useAutoRefresh';

export default function Vault() {
  const { user } = useAuth();
  const showToast = useToast();
  const mainAdmin = user?.role === 'main_admin';
  const subAdmin = user?.role === 'sub_admin';
  const adminReview = mainAdmin || subAdmin;
  const [artworks, setArtworks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [publishing, setPublishing] = useState('');
  const [pendingPublish, setPendingPublish] = useState(null);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);

  const load = useCallback(({ silent = false } = {}) => {
    if (!silent) { setLoading(true); setError(''); }
    return api.get(adminReview ? '/artworks/admin/vault' : '/artworks/vault', { params: { page, limit: 24 } })
      .then(({ data }) => { setArtworks(data.artworks || []); setPages(Math.max(1, data.pages || 1)); setError(''); })
      .catch((err) => { if (!silent) setError(err.response?.data?.message || 'Could not load the Vault.'); })
      .finally(() => { if (!silent) setLoading(false); });
  }, [adminReview, page]);

  useEffect(() => { load(); }, [load]);
  useAutoRefresh(() => load({ silent: true }));

  async function publish() {
    const artwork = pendingPublish;
    if (!artwork || publishing) return;
    setPendingPublish(null);
    setPublishing(artwork._id);
    try {
      await api.patch(`/artworks/${artwork._id}/visibility`, { visibility: 'public' });
      setArtworks((current) => current.filter((item) => item._id !== artwork._id));
      if (artworks.length === 1 && page > 1) setPage((value) => value - 1);
      showToast(`“${artwork.title}” is now public.`);
    } catch (err) {
      showToast(err.response?.data?.message || 'Could not publish this artwork.', true);
    } finally { setPublishing(''); }
  }

  return <section className="vault-page">
    <div className="page-head collection-page-head"><div>
      <div className="eyebrow">{adminReview ? `${mainAdmin ? 'MAIN ADMIN' : 'SUB-ADMIN'} · PRIVATE ARTWORK REVIEW` : 'MY STUDIO · PRIVATE ARTWORKS'}</div>
      <h1>{adminReview ? 'Artist Vault review' : 'My artwork Vault'}</h1>
      <div className="sub">{mainAdmin
        ? 'Review private artworks. Only the owning artist can publish them.'
        : subAdmin
          ? 'Monitor private artworks. This is view-only; you cannot edit, delete, or publish them.'
          : 'Keep artworks here until you are ready to make them public.'}</div>
    </div>{!adminReview && <Link className="btn btn-ghost" to="/my-artworks">All my artworks</Link>}</div>
    {loading ? <PageLoadState loading label="Vault" /> : error ? <PageLoadState error={error} onRetry={load} /> : !artworks.length
      ? <div className="empty">{adminReview ? 'No private artworks to review.' : <>Your Vault is empty. {user?.role === 'artist' && <><Link to="/upload">Upload a new artwork</Link> or </>}move one here from its detail page.</>}</div>
      : <><div className="vault-grid">{artworks.map((artwork) => <article className="vault-card" key={artwork._id}>
        <div className="vault-card-image"><ArtworkThumbnail artwork={artwork} alt={artwork.title} /></div>
        <div className="vault-card-body">
          <span className="my-artwork-status private">In Vault</span>
          <div className="collection-card-title-row"><h2 title={artwork.title}>{artwork.title}</h2><span className="collection-card-likes" aria-label={`${artwork.like_count || 0} likes`}>♡ {artwork.like_count || 0}</span></div>
          <ArtworkCardDetails artwork={artwork} fallbackArtist={adminReview ? null : user} />
          <div className="vault-card-actions">
            <Link className="my-artwork-view vault-card-link" to={`/artworks/${artwork._id}`} aria-label={`View artwork: ${artwork.title}`}><span className="collection-action-long">View artwork</span><span className="collection-action-short">View</span><span aria-hidden="true">→</span></Link>
            {!adminReview && <button type="button" className="btn btn-primary btn-sm" aria-label={`${publishing === artwork._id ? 'Publishing' : 'Make public'}: ${artwork.title}`} disabled={publishing === artwork._id} onClick={() => setPendingPublish(artwork)}>{publishing === artwork._id ? <><span className="collection-action-long">Publishing…</span><span className="collection-action-short">Wait…</span></> : <><span className="collection-action-long">Make public</span><span className="collection-action-short">Publish</span></>}</button>}
          </div>
        </div>
      </article>)}</div>{pages > 1 && <div className="vault-pagination"><button className="btn btn-ghost btn-sm" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Previous</button><span>Page {page} of {pages}</span><button className="btn btn-ghost btn-sm" disabled={page >= pages} onClick={() => setPage((value) => value + 1)}>Next</button></div>}</>}
    {pendingPublish && <ConfirmDialog
      title="Make artwork public?"
      message={`“${pendingPublish.title}” will leave your Vault and appear in the public gallery and on your artist profile.`}
      confirmLabel="Make public"
      onConfirm={publish}
      onCancel={() => setPendingPublish(null)}
    />}
  </section>;
}
