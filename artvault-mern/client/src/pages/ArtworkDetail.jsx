import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import ConfirmDialog from '../components/ConfirmDialog';
import ArtworkLikeButton from '../components/ArtworkLikeButton';
import PageLoadState from '../components/PageLoadState';
import ArtCard from '../components/ArtCard';

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

  function load() {
    setLoading(true);
    setError('');
    api
      .get(`/artworks/${id}`)
      .then((res) => {
        setArtwork(res.data.artwork);
        setExhibits(res.data.exhibits);
        setForm({
          title: res.data.artwork.title,
          description: res.data.artwork.description,
          materials: (res.data.artwork.materials || []).join(', '),
          categories: res.data.artwork.categories || [],
        });
      })
      .catch((err) => { setArtwork(undefined); setError(err.response?.data?.message || 'Could not load this artwork.'); })
      .finally(() => setLoading(false));
  }

  useEffect(load, [id]);
  useEffect(() => {
    if (!exhibitId) { setExhibitContext(null); return undefined; }
    let cancelled = false;
    api.get(`/exhibits/${exhibitId}`).then((response) => {
      if (!cancelled) setExhibitContext(response.data.exhibit || null);
    }).catch(() => { if (!cancelled) setExhibitContext(null); });
    return () => { cancelled = true; };
  }, [exhibitId]);
  useEffect(() => {
    const thumbnail = artwork?.thumbnail_url || '';
    const full = artwork?.image_url || '';
    setDisplayImage(thumbnail || full);
    if (!full || full === thumbnail) return undefined;
    const preload = new Image();
    preload.onload = () => setDisplayImage(full);
    preload.src = full;
    return () => { preload.onload = null; };
  }, [artwork]);
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
    const fullImage = artwork?.image_url || detailImage;
    setLightboxImage(detailImage);
    setLightboxOpen(true);
    if (fullImage === detailImage) { setLightboxLoading(false); return; }
    setLightboxLoading(true);
    const preload = new Image();
    preload.onload = () => { setLightboxImage(fullImage); setLightboxLoading(false); };
    preload.onerror = () => setLightboxLoading(false);
    preload.src = fullImage;
  }

  const canManage = user && artwork && (['admin', 'sub_admin', 'main_admin'].includes(user.role) || user.id === artwork.artist?._id);
  const detailImage = displayImage;
  const exhibitArtworkIndex = exhibitContext?.artworks?.findIndex((item) => String(item._id) === String(id)) ?? -1;
  const exhibitArtworkCount = exhibitContext?.artworks?.length || 0;
  function moveInExhibit(direction) {
    if (exhibitArtworkIndex < 0 || !exhibitArtworkCount) return;
    const nextIndex = (exhibitArtworkIndex + direction + exhibitArtworkCount) % exhibitArtworkCount;
    const nextArtwork = exhibitContext.artworks[nextIndex];
    if (nextArtwork?._id) navigate(`/artworks/${nextArtwork._id}?exhibit=${exhibitContext._id}&position=${nextIndex}`);
  }

  function toggleCategory(cat) {
    setForm((f) => ({
      ...f,
      categories: f.categories.includes(cat) ? f.categories.filter((c) => c !== cat) : [...f.categories, cat],
    }));
  }

  async function saveEdit() {
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

  if (loading) return <PageLoadState loading label="artwork…" />;
  if (error) return <PageLoadState error={error} onRetry={load} />;
  if (artwork === undefined) return <div className="empty">Artwork not found.</div>;

  return (
    <section>
      {exhibitContext && exhibitArtworkIndex >= 0 ? (
        <div className="exhibit-artwork-nav" aria-label={`Artwork navigation for ${exhibitContext.name}`}>
          <button type="button" onClick={() => moveInExhibit(-1)} aria-label="Previous artwork">‹</button>
          <span>{exhibitArtworkIndex + 1} of {exhibitArtworkCount} · {exhibitContext.name}</span>
          <button type="button" onClick={() => moveInExhibit(1)} aria-label="Next artwork">›</button>
        </div>
      ) : <button className="back-link" onClick={() => navigate(-1)}>← Back</button>}

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
              <div className="eyebrow">Artwork detail</div>
              <div className="eyebrow">{(artwork.categories || []).join(' · ')}</div>
              <h1>{artwork.title}</h1>
              <div className="detail-like"><ArtworkLikeButton artworkId={artwork._id} initialCount={artwork.like_count} /></div>
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
              {canManage && (
                <div className="detail-actions">
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
                <input value={form.materials} onChange={(e) => setForm({ ...form, materials: e.target.value })} />
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
    </section>
  );
}
