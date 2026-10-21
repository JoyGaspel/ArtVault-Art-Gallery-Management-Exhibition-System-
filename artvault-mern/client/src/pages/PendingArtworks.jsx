import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import ArtworkThumbnail from '../components/ArtworkThumbnail';
import OwnershipProofModal from '../components/OwnershipProofModal';
import PageLoadState from '../components/PageLoadState';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import useAutoRefresh from '../hooks/useAutoRefresh';

export default function PendingArtworks() {
  const { user } = useAuth();
  const showToast = useToast();
  const [artworks, setArtworks] = useState([]);
  const [proofArtwork, setProofArtwork] = useState(null);
  const [reviewingId, setReviewingId] = useState('');
  const [verified, setVerified] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(({ silent = false } = {}) => {
    if (!silent) { setLoading(true); setError(''); }
    return api.get('/artworks/admin/pending')
      .then(({ data }) => { setArtworks(data.artworks || []); setError(''); })
      .catch((err) => { if (!silent) setError(err.response?.data?.message || 'Could not load pending artworks.'); })
      .finally(() => { if (!silent) setLoading(false); });
  }, []);

  useEffect(() => { load(); }, [load]);
  useAutoRefresh(() => load({ silent: true }));

  async function decideReview(artwork, decision) {
    setReviewingId(artwork._id);
    try {
      await api.patch(`/artworks/${artwork._id}/review`, { decision, ownershipVerified: verified[artwork._id] === artwork.updated_at, expectedUpdatedAt: artwork.updated_at });
      setArtworks((current) => current.filter((item) => item._id !== artwork._id));
      showToast(decision === 'approve'
        ? `"${artwork.title}" approved for ${artwork.visibility === 'private' ? 'the artist’s Vault' : 'the public gallery'}.`
        : `"${artwork.title}" rejected and remains hidden.`);
      load({ silent: true });
    } catch (err) {
      showToast(err.response?.data?.message || 'Could not save the review decision.', true);
    } finally { setReviewingId(''); }
  }

  return <section className="pending-artworks-page">
    <div className="page-head">
      <div>
        <div className="eyebrow">Curation · artwork checks</div>
        <h1>Pending artworks</h1>
        <p className="sub">These submissions need a closer check because online matches were found, proof was uncertain, or automated checking was unavailable. Compare the artwork and online sources with creation or permission evidence before deciding.</p>
      </div>
      <Link className="back-link" to="/manage-gallery"><span className="back-link-icon" aria-hidden="true">←</span><span>Back to gallery management</span></Link>
    </div>
    <p className="pending-artworks-count" role="status">{artworks.length} awaiting review · {user?.role === 'main_admin' ? 'You can approve or reject.' : 'View and monitoring only.'}</p>
    <PageLoadState loading={loading} error={error} onRetry={load} label="pending artworks" />
    {!loading && !error && !artworks.length && <div className="empty">No artworks awaiting review.</div>}
    {!loading && !error && artworks.length > 0 && <div className="admin-list">
      {artworks.map((artwork) => <article className="admin-artist-card moderation-card" key={artwork._id}>
        <div className="moderation-art-preview"><ArtworkThumbnail artwork={artwork} alt={artwork.title} /></div>
        <div className="admin-artist-info">
          <h2>{artwork.title}</h2>
          <p>Local duplicates: {artwork.localCheckStatus === 'possible_duplicate' ? 'Possible similar image in ArtVault — review required' : artwork.localCheckStatus === 'no_local_match' ? 'No match among fingerprinted ArtVault records (not an internet search)' : 'Not checked or unavailable'}.</p>
          <p>Creation proof: {artwork.proofCheckStatus === 'credible' ? 'AI assessment supports creation evidence; not a guarantee of ownership' : artwork.proofCheckStatus === 'uncertain' ? 'Needs human review' : 'Not checked or assessment unavailable'}.</p>
          <p>Online search: {artwork.webCheckStatus === 'no_match' ? 'Cloud Vision returned no matches' : artwork.webCheckStatus === 'possible_match' ? 'Possible matches found' : 'Not checked successfully — manual search needed'}.</p>
          <p>by {artwork.artist?.name || 'Unknown artist'} · Chosen: {artwork.visibility === 'private' ? 'Vault' : 'Public gallery'}</p>
          <p>{artwork.reviewReason === 'possible_match' ? 'Possible online match — verify the source and permission' : artwork.reviewReason === 'ownership_review' ? 'Creation evidence needs manual verification' : artwork.reviewReason === 'proof_check_unavailable' ? 'Automated proof assessment unavailable — review the proof manually' : 'Online check unavailable or disabled — manually check sources and ownership'}</p>
          {(artwork.webMatchUrls || []).map((url, index) => <p key={url}><a href={url} target="_blank" rel="noopener noreferrer">Review match {index + 1}</a></p>)}
        </div>
        <div className="exhibit-row-actions">
          <Link className="btn btn-ghost btn-sm" to={`/artworks/${artwork._id}`}>View artwork</Link>
          <button className="btn btn-ghost btn-sm" type="button" onClick={() => setProofArtwork(artwork)}>View proof</button>
          <details className="upload-check-notice"><summary>Manual online-source review</summary><p>Open the artwork to inspect it, then use Google Lens or TinEye to upload the artwork image manually. This sends that image to the selected service; do not upload private ownership proof. An empty search result does not establish ownership. Compare sources, dates, and permission evidence before approving.</p><a className="btn btn-ghost btn-sm" href="https://lens.google/" target="_blank" rel="noopener noreferrer">Open Google Lens</a> <a className="btn btn-ghost btn-sm" href="https://tineye.com/" target="_blank" rel="noopener noreferrer">Open TinEye</a></details>
          {user?.role === 'main_admin' && <>
            <label><input type="checkbox" checked={verified[artwork._id] === artwork.updated_at} onChange={(event) => setVerified((current) => ({ ...current, [artwork._id]: event.target.checked ? artwork.updated_at : null }))} /> I reviewed the proof and online sources and verified ownership or permission.</label>
            <button className="btn btn-primary btn-sm" type="button" disabled={Boolean(reviewingId) || verified[artwork._id] !== artwork.updated_at} onClick={() => decideReview(artwork, 'approve')}>Approve</button>
            <button className="btn btn-danger btn-sm" type="button" disabled={Boolean(reviewingId)} onClick={() => decideReview(artwork, 'reject')}>Reject</button>
          </>}
        </div>
      </article>)}
    </div>}
    {proofArtwork && <OwnershipProofModal artworkId={proofArtwork._id} artworkTitle={proofArtwork.title} onClose={() => setProofArtwork(null)} />}
  </section>;
}
