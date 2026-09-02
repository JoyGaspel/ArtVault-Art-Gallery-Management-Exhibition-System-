import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import { useToast } from '../components/Toast';
import ConfirmDialog from '../components/ConfirmDialog';

const categories = [
  'Digital Art', 'Illustration', 'Textile Art', 'Crafts', 'Photography',
  'Sculpture', 'Painting', 'Traditional Art', 'Mixed Media', 'Calligraphy',
];

export default function ManageGallery() {
  const showToast = useToast();
  const [artworks, setArtworks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null);

  function load() {
    setLoading(true);
    api.get('/artworks', { params: { limit: 100 } })
      .then((response) => setArtworks(response.data.artworks))
      .catch((error) => showToast(error.response?.data?.message || 'Could not load gallery moderation.', true))
      .finally(() => setLoading(false));
  }
  useEffect(load, []);

  const visible = useMemo(() => {
    const value = query.trim().toLowerCase();
    if (!value) return artworks;
    return artworks.filter((artwork) => [artwork.title, artwork.artist?.name, ...(artwork.categories || [])]
      .filter(Boolean).some((item) => item.toLowerCase().includes(value)));
  }, [artworks, query]);

  function openEdit(artwork) {
    setEditing(artwork);
    setForm({
      title: artwork.title,
      description: artwork.description || '',
      materials: (artwork.materials || []).join(', '),
      categories: artwork.categories || [],
    });
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
      await api.put(`/artworks/${editing._id}`, {
        ...form,
        materials: form.materials.split(',').map((item) => item.trim()).filter(Boolean),
      });
      showToast(`"${form.title}" updated.`);
      setEditing(null);
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
              <div className="moderation-art-placeholder" aria-hidden="true">Art</div>
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
            <div className="field"><label>Title</label><input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></div>
            <div className="field"><label>Description</label><textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></div>
            <div className="field">
              <label>Categories</label>
              <div className="chip-select">{categories.map((item) => <button key={item} type="button" className={`chip-toggle${form.categories.includes(item) ? ' on' : ''}`} onClick={() => toggleCategory(item)}>{item}</button>)}</div>
            </div>
            <div className="field"><label>Materials</label><input value={form.materials} onChange={(event) => setForm({ ...form, materials: event.target.value })} /><div className="hint">Separate materials with commas.</div></div>
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
