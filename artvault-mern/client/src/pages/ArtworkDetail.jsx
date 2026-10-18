import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import ConfirmDialog from '../components/ConfirmDialog';
import ArtworkLikeButton from '../components/ArtworkLikeButton';
import PageLoadState from '../components/PageLoadState';
import ArtCard from '../components/ArtCard';
import useArtworkMedia from '../hooks/useArtworkMedia';
import useAutoRefresh from '../hooks/useAutoRefresh';
import { materialError } from '../utils/materialValidation';
import { goBackOr } from '../utils/navigation';

const ALL_CATEGORIES = [
  'Digital Art', 'Illustration', 'Textile Art', 'Crafts', 'Photography',
  'Sculpture', 'Painting', 'Traditional Art', 'Mixed Media', 'Calligraphy',
];

export default function ArtworkDetail() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const exhibitId = searchParams.get('exhibit');
  const { user } = useAuth();
  const navigate = useNavigate();
  const showToast = useToast();

  const [artwork, setArtwork] = useState(null);
  const [exhibits, setExhibits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [displayImage, setDisplayImage] = useState('');
  const [exhibitContext, setExhibitContext] = useState(null);
  const [relatedArtworks, setRelatedArtworks] = useState([]);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxImage, setLightboxImage] = useState('');
  const [lightboxLoading, setLightboxLoading] = useState(false);
  const [changingVisibility, setChangingVisibility] = useState(false);
  const [pendingVisibility, setPendingVisibility] = useState(null);
  const [proofLoading, setProofLoading] = useState(false);
  const currentIdRef = useRef(id);
  currentIdRef.current = id;
  const privateThumbnail = useArtworkMedia(artwork, 'thumbnail');
  const privateImage = useArtworkMedia(artwork, 'image');

  function load({ silent = false } = {}) {
    const requestedId = id;
    if (!silent) { setLoading(true); setError(''); }
    return api
      .get(`/artworks/${requestedId}`)
      .then((res) => {
        if (currentIdRef.current !== requestedId) return;
        setArtwork(res.data.artwork);
        setExhibits(res.data.exhibits);
        setError('');
        if (!silent || !editing) {
          setForm({
            title: res.data.artwork.title,
            description: res.data.artwork.description,
            materials: (res.data.artwork.materials || []).join(', '),
            categories: res.data.artwork.categories || [],
          });
        }
      })
      .catch((err) => { if (!silent && currentIdRef.current === requestedId) { setArtwork(undefined); setError(err.response?.data?.message || 'Could not load this artwork.'); } })
      .finally(() => { if (!silent && currentIdRef.current === requestedId) setLoading(false); });
  }

  useEffect(() => { load(); }, [id]);
  useAutoRefresh(() => { if (!editing && !lightboxOpen) load({ silent: true }); });
  useEffect(() => {
    if (!exhibitId) { setExhibitContext(null); return undefined; }
    let cancelled = false;
    api.get(`/exhibits/${exhibitId}`).then((response) => {
      if (!cancelled) setExhibitContext(response.data.exhibit || null);
    }).catch(() => { if (!cancelled) setExhibitContext(null); });
    return () => { cancelled = true; };
  }, [exhibitId]);
  useEffect(() => {
    const thumbnail = artwork?.visibility === 'private' ? privateThumbnail : (artwork?.thumbnail_url || '');
    const full = artwork?.visibility === 'private' ? privateImage : (artwork?.image_url || '');
    setDisplayImage(thumbnail || full);
    if (!full || full === thumbnail) return undefined;
    const preload = new Image();
    preload.onload = () => setDisplayImage(full);
    preload.src = full;
    return () => { preload.onload = null; };
  }, [artwork?._id, artwork?.visibility, artwork?.thumbnail_url, artwork?.image_url, privateThumbnail, privateImage]);
  useEffect(() => {
    const artistId = artwork?.artist?._id;
    if (!artistId) { setRelatedArtworks([]); return undefined; }
    let cancelled = false;
    api.get('/artworks', { params: { artist: artistId, limit: 5 } }).then((response) => {
      if (!cancelled) setRelatedArtworks((response.data.artworks || []).filter((item) => String(item._id) !== String(id)).slice(0, 4));
    }).catch(() => { if (!cancelled) setRelatedArtworks([]); });
    return () => { cancelled = true; };
  }, [artwork?.artist?._id, id]);
  useEffect(() => setZoom(1), [id]);
  useEffect(() => {
    document.documentElement.style.setProperty('--detail-zoom', String(zoom));
    return () => document.documentElement.style.removeProperty('--detail-zoom');
  }, [zoom]);
  useEffect(() => {
    if (!lightboxOpen) return undefined;
    const closeOnEscape = (event) => { if (event.key === 'Escape') setLightboxOpen(false); };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [lightboxOpen]);

  function openLightbox() {
    if (!detailImage) return;
    const fullImage = artwork?.visibility === 'private' ? (privateImage || detailImage) : (artwork?.image_url || detailImage);
    setLightboxImage(detailImage);
    setLightboxOpen(true);
    if (fullImage === detailImage) { setLightboxLoading(false); return; }
    setLightboxLoading(true);
    const preload = new Image();
    preload.onload = () => { setLightboxImage(fullImage); setLightboxLoading(false); };
    preload.onerror = () => setLightboxLoading(false);
    preload.src = fullImage;
  }

  const isOwner = Boolean(user && artwork && user.id === artwork.artist?._id);
  const canManage = user && artwork && !(artwork.visibility === 'private' && user.role === 'sub_admin') && (isOwner || user.role === 'main_admin' || (artwork.visibility !== 'private' && ['admin', 'sub_admin'].includes(user.role)));
  const detailImage = displayImage;
  const exhibitArtworkIndex = exhibitContext?.artworks?.findIndex((item) => String(item._id) === String(id)) ?? -1;
  const exhibitArtworkCount = exhibitContext?.artworks?.length || 0;
  function moveInExhibit(direction) {
    if (exhibitArtworkIndex < 0 || !exhibitArtworkCount) return;
    const nextIndex = (exhibitArtworkIndex + direction + exhibitArtworkCount) % exhibitArtworkCount;
    const nextArtwork = exhibitContext.artworks[nextIndex];
    if (nextArtwork?._id && String(nextArtwork._id) !== String(id)) {
      setLoading(true);
      setEditing(false);
      // Carousel steps should not fill browser history; Back returns to the exhibit.
      navigate(`/artworks/${nextArtwork._id}?exhibit=${exhibitContext._id}&position=${nextIndex}`, { replace: true });
    }
  }

  async function downloadOwnershipProof() {
    if (proofLoading || !artwork?.has_ownership_evidence) return;
    setProofLoading(true);
    try {
      const response = await api.get(`/artworks/${id}/ownership-evidence`, { responseType: 'blob' });
      const url = URL.createObjectURL(response.data);
      const link = document.createElement('a');
      link.href = url;
      link.download = `artvault-ownership-proof-${id}.jpg`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err) { showToast(err.response?.data?.message || 'Could not load the private proof.', true); }
    finally { setProofLoading(false); }
  }

  function toggleCategory(cat) {
    setForm((f) => ({
      ...f,
      categories: f.categories.includes(cat) ? f.categories.filter((c) => c !== cat) : [...f.categories, cat],
    }));
  }

  async function saveEdit() {
    const materialsIssue = materialError(form.materials);
    if (materialsIssue) { showToast(materialsIssue, true); return; }
    setSaving(true);
    try {
      const res = await api.put(`/artworks/${id}`, {
        title: form.title,
        description: form.description,
        materials: form.materials.split(',').map((s) => s.trim()).filter(Boolean),
        categories: form.categories,
      });
      setArtwork(res.data.artwork);
      setEditing(false);
      showToast(`"${res.data.artwork.title}" updated.`);
    } catch (err) {
      showToast(err.response?.data?.message || 'Could not save changes.', true);
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    setPendingDelete(true);
  }
  async function confirmRemove() {
    setPendingDelete(false);
    try {
      await api.delete(`/artworks/${id}`);
      showToast(`"${artwork.title}" removed from the gallery.`);
      navigate('/');
    } catch (err) {
      showToast(err.response?.data?.message || 'Could not remove this artwork.', true);
    }
  }

  async function changeVisibility() {
    const next = pendingVisibility;
    if (!next || changingVisibility) return;
    setPendingVisibility(null);
    setChangingVisibility(true);
    try {
      const { data } = await api.patch(`/artworks/${id}/visibility`, { visibility: next });
      setArtwork((current) => ({ ...current, ...data.artwork, image_url: '', thumbnail_url: '' }));
      load();
      showToast(next === 'private' ? 'Artwork moved to your Vault.' : 'Artwork is now public.');
    } catch (err) { showToast(err.response?.data?.message || 'Could not change artwork visibility.', true); }
    finally { setChangingVisibility(false); }
  }

  if (loading) return <PageLoadState loading label="artwork…" />;
  if (error) return <PageLoadState error={error} onRetry={load} />;
  if (artwork === undefined) return <div className="empty">Artwork not found.</div>;

  return (
    <section>
      {exhibitContext && exhibitArtworkIndex >= 0 ? (
        <>
          <Link className="back-link" to={`/exhibits/${exhibitContext._id}`} replace>← Back to exhibit</Link>
          <div className="exhibit-artwork-nav" aria-label={`Artwork navigation for ${exhibitContext.name}`}>
            <button type="button" onClick={() => moveInExhibit(-1)} aria-label="Previous artwork">‹</button>
            <span>{exhibitArtworkIndex + 1} of {exhibitArtworkCount} · {exhibitContext.name}</span>
            <button type="button" onClick={() => moveInExhibit(1)} aria-label="Next artwork">›</button>
          </div>
        </>
      ) : <button className="back-link" type="button" onClick={() => goBackOr(navigate, artwork?.visibility === 'private' && isOwner ? '/vault' : '/')}>← Back</button>}

      {artwork.has_image && (
        <div className="image-zoom-controls" aria-label="Artwork image zoom controls">
          <button type="button" onClick={() => setZoom((value) => Math.max(1, value - 0.25))} disabled={zoom <= 1} aria-label="Zoom out">−</button>
          <span>{Math.round(zoom * 100)}%</span>
          <button type="button" onClick={() => setZoom((value) => Math.min(2, value + 0.25))} disabled={zoom >= 2} aria-label="Zoom in">+</button>
          <button type="button" onClick={() => setZoom(1)} disabled={zoom === 1}>Reset</button>
        </div>
      )}
      <div className="detail-layout">
              <div className={`detail-hero${detailImage ? ' is-viewable' : ''}`} role={detailImage ? 'button' : undefined} tabIndex={detailImage ? 0 : undefined} onClick={() => detailImage && openLightbox()} onKeyDown={(event) => { if (detailImage && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); openLightbox(); } }}>{detailImage ? <><img src={detailImage} alt={artwork.title} loading="eager" decoding="async" fetchPriority="high" /><span className="detail-hero-hint">Open full view</span><button type="button" className="detail-full-view-button" aria-label="Open full artwork view" onClick={(event) => { event.stopPropagation(); openLightbox(); }}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3M21 16v3a2 2 0 0 1-2 2h-3M8 21H5a2 2 0 0 1-2-2v-3" /></svg></button></> : '🖼️'}</div>
        <div className="detail-body">
          {!editing ? (
            <>
              <div className="eyebrow">{artwork.visibility === 'private' ? (isOwner ? 'Private · My artwork Vault' : 'Private · Artist Vault') : 'Artwork detail'}</div>
              <div className="eyebrow">{(artwork.categories || []).join(' · ')}</div>
              <h1>{artwork.title}</h1>
              {artwork.visibility !== 'private' && <div className="detail-like"><ArtworkLikeButton artworkId={artwork._id} initialCount={artwork.like_count} /></div>}
              {artwork.artist && (
                <Link to={`/artists/${artwork.artist._id}`} className="detail-artist">
                  <span className="av">{(artwork.artist.name || '?').slice(0, 2).toUpperCase()}</span>
                  <span className="name">{artwork.artist.name}</span>
                </Link>
              )}
              <div className="detail-description"><div className="lbl">About this work</div><p className="detail-desc">{artwork.description || 'No description provided.'}</p></div>
              <div className="meta-grid">
                <div className="meta-box">
                  <div className="lbl">Materials</div>
                  <div className="val">{(artwork.materials || []).join(', ') || '—'}</div>
                </div>
                <div className="meta-box">
                  <div className="lbl">Categories</div>
                  <div className="val">{(artwork.categories || []).join(', ') || '—'}</div>
                </div>
                <div className="meta-box">
                  <div className="lbl">Created</div>
                  <div className="val">{new Date(artwork.created_at).toLocaleDateString()}</div>
                </div>
                <div className="meta-box">
                  <div className="lbl">Appears in</div>
                  <div className="val">{exhibits.length ? exhibits.map((e) => e.name).join(', ') : 'Not currently featured'}</div>
                </div>
              </div>
              {artwork.has_ownership_evidence && ['admin', 'sub_admin', 'main_admin'].includes(user?.role) && <button type="button" className="btn btn-ghost ownership-proof-button" onClick={downloadOwnershipProof} disabled={proofLoading}>{proofLoading ? 'Loading proof…' : 'Download ownership proof'}</button>}
              {canManage && (
                <div className="detail-actions">
                  {isOwner && user.role !== 'sub_admin' && <button className="btn btn-primary" onClick={() => setPendingVisibility(artwork.visibility === 'private' ? 'public' : 'private')} disabled={changingVisibility}>{changingVisibility ? 'Saving…' : artwork.visibility === 'private' ? 'Make public' : 'Move to Vault'}</button>}
                  <button className="btn btn-ghost" onClick={() => setEditing(true)}>Edit details</button>
                  <button className="btn btn-danger" onClick={remove}>Remove artwork</button>
                </div>
              )}
            </>
          ) : (
            <>
              <h1 style={{ marginBottom: 18 }}>Edit artwork</h1>
              <div className="field">
                <label>Title <span className="required-mark" aria-hidden="true">*</span></label>
                <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              </div>
              <div className="field">
                <label>Description <span className="optional-mark">(optional)</span></label>
                <textarea maxLength={1000} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                <div className="hint">{form.description.length}/1000 characters</div>
              </div>
              <div className="field">
                <label>Categories <span className="optional-mark">(optional)</span></label>
                <div className="chip-select">
                  {ALL_CATEGORIES.map((c) => (
                    <button
                      type="button" key={c}
                      className={`chip-toggle${form.categories.includes(c) ? ' on' : ''}`}
                      onClick={() => toggleCategory(c)}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>
              <div className="field">
                <label>Materials <span className="optional-mark">(optional)</span></label>
                <input value={form.materials} onChange={(e) => setForm({ ...form, materials: e.target.value })} aria-invalid={Boolean(materialError(form.materials))} aria-describedby="artwork-edit-materials-help" />
                <div className="hint" id="artwork-edit-materials-help">{materialError(form.materials) || 'Use recognizable material names, separated by commas.'}</div>
              </div>
              <div className="detail-actions">
                <button className="btn btn-primary" onClick={saveEdit} disabled={saving}>
                  {saving ? <span className="spinner" /> : null}
                  {saving ? 'Saving…' : 'Save changes'}
                </button>
                <button className="btn btn-ghost" onClick={() => setEditing(false)}>Cancel</button>
              </div>
            </>
          )}
        </div>
      </div>
      {!editing && relatedArtworks.length > 0 && <section className="related-artworks"><div className="section-kicker">More from this artist</div><h2>Continue exploring</h2><div className="gallery-grid related-gallery">{relatedArtworks.map((item) => <ArtCard key={item._id} artwork={item} />)}</div></section>}
      {lightboxOpen && lightboxImage && <div className="art-lightbox" role="dialog" aria-modal="true" aria-label={`${artwork.title} full view`} onClick={() => setLightboxOpen(false)}><button type="button" className="art-lightbox-close" aria-label="Close full view" onClick={() => setLightboxOpen(false)}>×</button><div className="art-lightbox-frame"><img src={lightboxImage} alt={artwork.title} onClick={(event) => event.stopPropagation()} />{lightboxLoading && <span className="art-lightbox-loading" role="status">Loading full resolution…</span>}</div></div>}
      {pendingDelete && <ConfirmDialog title="Archive artwork?" message={`“${artwork.title}” will be moved to Archives before removal.`} confirmLabel="Move to archives" danger onConfirm={confirmRemove} onCancel={() => setPendingDelete(false)} />}
      {pendingVisibility && <ConfirmDialog
        title={pendingVisibility === 'private' ? 'Move artwork to Vault?' : 'Make artwork public?'}
        message={pendingVisibility === 'private'
          ? `“${artwork.title}” will be hidden from the public gallery, your profile, and exhibits until you publish it again.`
          : `“${artwork.title}” will appear in the public gallery and on your artist profile again.`}
        confirmLabel={pendingVisibility === 'private' ? 'Move to Vault' : 'Make public'}
        onConfirm={changeVisibility}
        onCancel={() => setPendingVisibility(null)}
      />}
    </section>
  );
}
