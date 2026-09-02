import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import ConfirmDialog from '../components/ConfirmDialog';

const ALL_CATEGORIES = [
  'Digital Art', 'Illustration', 'Textile Art', 'Crafts', 'Photography',
  'Sculpture', 'Painting', 'Traditional Art', 'Mixed Media', 'Calligraphy',
];

export default function ArtworkDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const showToast = useToast();

  const [artwork, setArtwork] = useState(null);
  const [exhibits, setExhibits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(false);

  function load() {
    setLoading(true);
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
      .catch(() => setArtwork(undefined))
      .finally(() => setLoading(false));
  }

  useEffect(load, [id]);

  const canManage = user && artwork && (['admin', 'sub_admin', 'main_admin'].includes(user.role) || user.id === artwork.artist?._id);

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

  if (loading) return <div className="empty">Loading…</div>;
  if (artwork === undefined) return <div className="empty">Artwork not found.</div>;

  return (
    <section>
      <button className="back-link" onClick={() => navigate(-1)}>← Back</button>

      <div className="detail-layout">
        <div className="detail-hero">🖼️</div>
        <div className="detail-body">
          {!editing ? (
            <>
              <div className="eyebrow">{(artwork.categories || []).join(' · ')}</div>
              <h1>{artwork.title}</h1>
              {artwork.artist && (
                <Link to={`/artists/${artwork.artist._id}`} className="detail-artist">
                  <span className="av">{(artwork.artist.name || '?').slice(0, 2).toUpperCase()}</span>
                  <span className="name">{artwork.artist.name}</span>
                </Link>
              )}
              <p className="detail-desc">{artwork.description || 'No description provided.'}</p>
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
                <label>Title</label>
                <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              </div>
              <div className="field">
                <label>Description</label>
                <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </div>
              <div className="field">
                <label>Categories</label>
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
                <label>Materials (comma separated)</label>
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
      {pendingDelete && <ConfirmDialog title="Archive artwork?" message={`“${artwork.title}” will be moved to Archives before removal.`} confirmLabel="Move to archives" danger onConfirm={confirmRemove} onCancel={() => setPendingDelete(false)} />}
    </section>
  );
}
