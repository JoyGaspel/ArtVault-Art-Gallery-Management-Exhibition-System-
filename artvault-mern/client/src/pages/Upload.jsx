import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { useToast } from '../components/Toast';

const ALL_CATEGORIES = [
  'Digital Art', 'Illustration', 'Textile Art', 'Crafts', 'Photography',
  'Sculpture', 'Painting', 'Traditional Art', 'Mixed Media', 'Calligraphy',
];

export default function Upload() {
  const navigate = useNavigate();
  const showToast = useToast();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [materials, setMaterials] = useState('');
  const [categories, setCategories] = useState(['Digital Art']);
  const [titleErr, setTitleErr] = useState(false);
  const [saving, setSaving] = useState(false);

  function toggleCategory(cat) {
    setCategories((c) => (c.includes(cat) ? c.filter((x) => x !== cat) : [...c, cat]));
  }

  async function publish() {
    if (!title.trim()) {
      setTitleErr(true);
      return;
    }
    setSaving(true);
    try {
      const res = await api.post('/artworks', {
        title,
        description,
        materials: materials.split(',').map((s) => s.trim()).filter(Boolean),
        categories,
      });
      showToast(`"${res.data.artwork.title}" published to the gallery.`);
      navigate(`/artworks/${res.data.artwork._id}`);
    } catch (err) {
      showToast(err.response?.data?.message || 'Could not publish this artwork.', true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section>
      <div className="page-head">
        <div>
          <div className="eyebrow">POST /api/artworks</div>
          <h1>Upload an artwork</h1>
          <div className="sub">Add a new piece to your portfolio and the public gallery.</div>
        </div>
      </div>

      <div className="form-card">
        <div className="field">
          <label>Title</label>
          <input
            value={title}
            onChange={(e) => { setTitle(e.target.value); setTitleErr(false); }}
            placeholder="e.g. Sunset Dreams"
            style={titleErr ? { outline: '2px solid #C15656' } : undefined}
          />
          {titleErr && <div className="hint" style={{ color: '#A34848' }}>Give this piece a title before publishing.</div>}
        </div>
        <div className="field">
          <label>Description</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What is this piece about?" />
        </div>
        <div className="field">
          <label>Categories</label>
          <div className="chip-select">
            {ALL_CATEGORIES.map((c) => (
              <button
                type="button" key={c}
                className={`chip-toggle${categories.includes(c) ? ' on' : ''}`}
                onClick={() => toggleCategory(c)}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
        <div className="field">
          <label>Materials</label>
          <input value={materials} onChange={(e) => setMaterials(e.target.value)} placeholder="e.g. Cotton thread, natural dye" />
          <div className="hint">Separate materials with commas.</div>
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
          <button className="btn btn-primary" onClick={publish} disabled={saving}>
            {saving ? <span className="spinner" /> : null}
            {saving ? 'Publishing…' : 'Publish artwork'}
          </button>
          <button className="btn btn-ghost" onClick={() => navigate('/')}>Cancel</button>
        </div>
      </div>
    </section>
  );
}
