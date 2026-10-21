import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import ArtworkThumbnail from '../components/ArtworkThumbnail';
import ArtworkPreviewModal from '../components/ArtworkPreviewModal';
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
  const [previewArtwork, setPreviewArtwork] = useState(null);
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
        <p className="sub">Review each artwork and its creation or permission evidence before deciding. When automatic online search is not enabled, submissions wait here for manual review. Being pending does not mean the artist copied the work.</p>
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
          <p>Online search: {artwork.webCheckStatus === 'no_match' ? 'Cloud Vision returned no matches; this does not establish ownership' : artwork.webCheckStatus === 'possible_match' ? 'Possible matches found — compare the sources' : artwork.webCheckStatus === 'disabled' ? 'Automatic search was off for this submission — use manual source review' : 'No successful automatic search recorded — use manual source review'}.</p>
          <p>by {artwork.artist?.name || 'Unknown artist'} · Chosen: {artwork.visibility === 'private' ? 'Vault' : 'Public gallery'}</p>
          <p className="pending-review-reason">{artwork.reviewReason === 'local_duplicate' ? 'Possible duplicate in ArtVault — compare the submissions and permission evidence.' : artwork.reviewReason === 'possible_match' ? 'Possible online match — verify the source and permission.' : artwork.reviewReason === 'ownership_review' ? 'Creation evidence needs manual verification.' : artwork.reviewReason === 'proof_check_unavailable' ? 'Review the proof manually; no successful automated proof assessment was recorded.' : 'Awaiting manual ownership review. Review the proof and check online sources using the tools below.'}</p>
          {(artwork.webMatchUrls || []).map((url, index) => <p key={url}><a href={url} target="_blank" rel="noopener noreferrer">Review match {index + 1}</a></p>)}
        </div>
        <div className="exhibit-row-actions">
          <button className="btn btn-ghost btn-sm" type="button" onClick={() => setPreviewArtwork(artwork)}>View artwork</button>
          <button className="btn btn-ghost btn-sm" type="button" onClick={() => setProofArtwork(artwork)}>View proof</button>
          <details className="upload-check-notice manual-source-review">
            <summary>Check online sources manually</summary>
            <div className="manual-source-review-body">
              <p>Automatic online search is optional. Use these external tools to help review this submission.</p>
              <ol>
                <li>Open the artwork and save its image to your device.</li>
                <li>Open Google Lens or TinEye below, then upload the saved artwork image.</li>
                <li>Compare any matching pages, publication dates, and the artist's creation or permission evidence.</li>
              </ol>
              <div className="manual-source-review-links">
                <a className="btn btn-ghost btn-sm" href="https://lens.google/" target="_blank" rel="noopener noreferrer">Open Google Lens (new tab)</a>
                <a className="btn btn-ghost btn-sm" href="https://tineye.com/" target="_blank" rel="noopener noreferrer">Open TinEye (new tab)</a>
              </div>
              <p className="manual-source-review-note">Only upload the artwork to these services, never private proof. These buttons open a new tab; they do not run a check inside ArtVault. No matches does not prove ownership.</p>
            </div>
          </details>
          {user?.role === 'main_admin' && <>
            <label><input type="checkbox" checked={verified[artwork._id] === artwork.updated_at} onChange={(event) => setVerified((current) => ({ ...current, [artwork._id]: event.target.checked ? artwork.updated_at : null }))} /> I reviewed the proof and online sources and verified ownership or permission.</label>
            <button className="btn btn-primary btn-sm" type="button" disabled={Boolean(reviewingId) || verified[artwork._id] !== artwork.updated_at} onClick={() => decideReview(artwork, 'approve')}>Approve</button>
            <button className="btn btn-danger btn-sm" type="button" disabled={Boolean(reviewingId)} onClick={() => decideReview(artwork, 'reject')}>Reject</button>
          </>}
        </div>
      </article>)}
    </div>}
    {proofArtwork && <OwnershipProofModal artworkId={proofArtwork._id} artworkTitle={proofArtwork.title} onClose={() => setProofArtwork(null)} />}
    {previewArtwork && <ArtworkPreviewModal key={previewArtwork._id} artwork={previewArtwork} onClose={() => setPreviewArtwork(null)} />}
  </section>;
}
