import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api from '../api';
import { useToast } from '../components/Toast';
import ConfirmDialog from '../components/ConfirmDialog';
import useAutoRefresh from '../hooks/useAutoRefresh';

const categories = [
  'Digital Art', 'Illustration', 'Textile Art', 'Crafts', 'Photography',
  'Sculpture', 'Painting', 'Traditional Art', 'Mixed Media', 'Calligraphy',
];
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];

function ModerationThumbnail({ artwork }) {
  const [failed, setFailed] = useState(false);
  const apiBase = (api.defaults.baseURL || '/api').replace(/\/$/, '');
  const imageSrc = artwork.image_path || (artwork.has_image !== false ? `${apiBase}/artworks/${artwork._id}/image` : '');

  return (
    <div className="moderation-art-preview">
      {imageSrc && !failed
        ? <img src={imageSrc} alt="" loading="lazy" decoding="async" onError={() => setFailed(true)} />
        : <span aria-hidden="true">Art</span>}
    </div>
  );
}

export default function ManageGallery() {
  const showToast = useToast();
  const [artworks, setArtworks] = useState([]);
  const [params] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState(() => params.get('search') || '');
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [image, setImage] = useState(null);
  const [imagePreview, setImagePreview] = useState('');
  const imageInputRef = useRef(null);

  function load() {
    setLoading(true);
    api.get('/artworks', { params: { limit: 100 } })
      .then((response) => setArtworks(response.data.artworks))
      .catch((error) => showToast(error.response?.data?.message || 'Could not load gallery moderation.', true))
      .finally(() => setLoading(false));
  }
  useEffect(load, []);
  useAutoRefresh(load);

  const visible = useMemo(() => {
    const value = query.trim().toLowerCase();
    if (!value) return artworks;
    return artworks.filter((artwork) => [artwork.title, artwork.artist?.name, ...(artwork.categories || [])]
      .filter(Boolean).some((item) => item.toLowerCase().includes(value)));
  }, [artworks, query]);

  function openEdit(artwork) {
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setEditing(artwork);
    setImage(null);
    setImagePreview(`${(api.defaults.baseURL || '/api').replace(/\/$/, '')}/artworks/${artwork._id}/image`);
    setForm({
      title: artwork.title,
      description: artwork.description || '',
      materials: (artwork.materials || []).join(', '),
      categories: artwork.categories || [],
    });
  }

  function handleImageChange(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const extensionLooksValid = /\.(png|jpe?g|webp|gif)$/i.test(file.name);
    if (!ALLOWED_IMAGE_TYPES.includes(file.type) && !extensionLooksValid) {
      showToast('Only PNG, JPG/JPEG, WebP, or GIF images are allowed.', true);
      event.target.value = '';
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      showToast('Image must be 10 MB or smaller.', true);
      event.target.value = '';
      return;
    }
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImage(file);
    setImagePreview(URL.createObjectURL(file));
  }

  function clearImageSelection() {
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImage(null);
    setImagePreview(editing ? `${(api.defaults.baseURL || '/api').replace(/\/$/, '')}/artworks/${editing._id}/image` : '');
    if (imageInputRef.current) imageInputRef.current.value = '';
  }

  function toggleCategory(category) {
    setForm((current) => ({
      ...current,
      categories: current.categories.includes(category)
        ? current.categories.filter((item) => item !== category)
        : [...current.categories, category],
    }));
  }

  async function save() {
    if (!form.title.trim()) {
      showToast('Artwork title is required.', true);
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...form,
        title: form.title.trim().replace(/\s+/g, ' '),
        description: form.description.trim().replace(/\s+/g, ' '),
        materials: form.materials.split(',').map((item) => item.trim()).filter(Boolean),
      };
      if (image) {
        payload.image_path = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = () => reject(new Error('Could not read the replacement image.'));
          reader.readAsDataURL(image);
        });
      }
      const response = await api.put(`/artworks/${editing._id}`, payload);
      showToast(`"${form.title}" updated.`);
      setEditing(null);
      setArtworks((current) => current.map((item) => item._id === editing._id ? { ...item, ...response.data.artwork } : item));
      if (imagePreview) URL.revokeObjectURL(imagePreview);
      setImage(null); setImagePreview('');
      load();
    } catch (error) {
      showToast(error.response?.data?.message || 'Could not update this artwork.', true);
    } finally {
      setSaving(false);
    }
  }

  async function remove(artwork) {
    setPendingDelete(artwork);
  }
  async function confirmRemove() {
    const artwork = pendingDelete; setPendingDelete(null); if (!artwork) return;
    try {
      await api.delete(`/artworks/${artwork._id}`);
      showToast(`"${artwork.title}" removed from the gallery.`);
      setArtworks((current) => current.filter((item) => item._id !== artwork._id));
      load();
    } catch (error) {
      showToast(error.response?.data?.message || 'Could not remove this artwork.', true);
    }
  }

  return (
    <section>
      <div className="page-head">
        <div>
          <div className="eyebrow">Admin moderation</div>
          <h1>Manage gallery</h1>
          <div className="sub">Review every published artwork and correct or remove content quickly.</div>
        </div>
      </div>

      <div className="stat-row">
        <div className="stat-box"><div className="num">{artworks.length}</div><div className="lbl">Published artworks</div></div>
        <div className="stat-box"><div className="num">{new Set(artworks.map((artwork) => artwork.artist?._id).filter(Boolean)).size}</div><div className="lbl">Contributing artists</div></div>
        <div className="stat-box"><div className="num">{visible.length}</div><div className="lbl">Current review results</div></div>
      </div>

      <div className="moderation-toolbar">
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by artwork, artist, or category" aria-label="Search artworks" />
        <span>{visible.length} of {artworks.length} shown</span>
      </div>

      {loading && <div className="empty">Loading gallery...</div>}
      {!loading && visible.length === 0 && <div className="empty">No artworks match this review.</div>}
      {!loading && visible.length > 0 && (
        <div className="admin-list">
          {visible.map((artwork) => (
            <article className="admin-artist-card moderation-card" key={artwork._id}>
              <ModerationThumbnail artwork={artwork} />
              <div className="admin-artist-info">
                <h2>{artwork.title}</h2>
                <div className="mono admin-artist-email">by {artwork.artist?.name || 'Unknown artist'} · {new Date(artwork.created_at).toLocaleDateString()}</div>
                <div className="admin-artist-tags">
                  {(artwork.categories || []).length ? artwork.categories.map((item) => <span className="tiny-tag" key={item}>{item}</span>) : <span className="admin-muted">Uncategorised</span>}
                </div>
              </div>
              <div className="exhibit-row-actions">
                <Link className="btn btn-ghost btn-sm" to={`/artworks/${artwork._id}`}>View</Link>
                <button className="btn btn-ghost btn-sm" type="button" onClick={() => openEdit(artwork)}>Edit</button>
                <button className="btn btn-danger btn-sm" type="button" onClick={() => remove(artwork)}>Remove</button>
              </div>
            </article>
          ))}
        </div>
      )}

      {editing && (
        <div className="modal-overlay" onClick={(event) => event.target === event.currentTarget && setEditing(null)}>
          <div className="modal-box">
            <div className="modal-head">
              <div><div className="eyebrow">Moderate artwork</div><h2>Edit {editing.title}</h2></div>
              <button className="modal-close" type="button" aria-label="Close" onClick={() => setEditing(null)}>x</button>
            </div>
            <div className="field"><label>Title <span className="required-mark" aria-hidden="true">*</span></label><input maxLength={50} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></div>
            <div className="field"><label>Description <span className="optional-mark">(optional)</span></label><textarea maxLength={1000} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /><div className="hint">{form.description.length}/1000 characters</div></div>
            <div className="field"><label htmlFor="moderation-artwork-image">Artwork image <span className="optional-mark">(optional)</span></label><input ref={imageInputRef} className="file-input" id="moderation-artwork-image" type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={handleImageChange} /><div className="hint">Choose a replacement image. PNG, JPG/JPEG, WebP, or GIF up to 10 MB.</div>{imagePreview && <div className="moderation-edit-preview"><img src={imagePreview} alt="Artwork preview" /><button type="button" className="upload-preview-remove" onClick={clearImageSelection} aria-label="Clear replacement image">×</button></div>}</div>
            <div className="field">
              <label>Categories <span className="optional-mark">(optional)</span></label>
              <div className="chip-select">{categories.map((item) => <button key={item} type="button" className={`chip-toggle${form.categories.includes(item) ? ' on' : ''}`} onClick={() => toggleCategory(item)}>{item}</button>)}</div>
            </div>
            <div className="field"><label>Materials <span className="optional-mark">(optional)</span></label><input value={form.materials} onChange={(event) => setForm({ ...form, materials: event.target.value })} /><div className="hint">Separate materials with commas.</div></div>
            <div className="modal-actions">
              <button className="btn btn-ghost" type="button" onClick={() => setEditing(null)}>Cancel</button>
              <button className="btn btn-primary" type="button" onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save changes'}</button>
            </div>
          </div>
        </div>
      )}
      {pendingDelete && <ConfirmDialog title="Archive artwork?" message={`“${pendingDelete.title}” will be moved to Archives and removed from the public gallery.`} confirmLabel="Move to archives" danger onConfirm={confirmRemove} onCancel={() => setPendingDelete(null)} />}
    </section>
  );
}
