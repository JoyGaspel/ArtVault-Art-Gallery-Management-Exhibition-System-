import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { useToast } from '../components/Toast';
import { useAuth } from '../context/AuthContext';

const ALL_CATEGORIES = [
  'Digital Art', 'Illustration', 'Textile Art', 'Crafts', 'Photography',
  'Sculpture', 'Painting', 'Traditional Art', 'Mixed Media', 'Calligraphy',
];
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];

export default function Upload() {
  const navigate = useNavigate();
  const showToast = useToast();
  const { user } = useAuth();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [materials, setMaterials] = useState('');
  const [categories, setCategories] = useState(['Digital Art']);
  const [titleErr, setTitleErr] = useState(false);
  const [saving, setSaving] = useState(false);
  const [image, setImage] = useState(null);
  const [preview, setPreview] = useState('');

  function toggleCategory(cat) {
    setCategories((c) => (c.includes(cat) ? c.filter((x) => x !== cat) : [...c, cat]));
  }

  function handleImageChange(event) {
    const file = event.target.files?.[0];
    if (!file) { setImage(null); setPreview(''); return; }
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      setImage(null);
      setPreview('');
      showToast('Only PNG, JPG/JPEG, WebP, or GIF images are allowed.', true);
      event.target.value = '';
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setImage(null);
      setPreview('');
      showToast('Image must be 10 MB or smaller.', true);
      event.target.value = '';
      return;
    }
    setImage(file);
    setPreview(URL.createObjectURL(file));
  }

  async function publish() {
    if (!title.trim()) {
      setTitleErr(true);
      return;
    }
    setSaving(true);
    try {
      let image_path = '';
      if (image) {
        image_path = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = () => reject(new Error('Could not read the image file.'));
          reader.readAsDataURL(image);
        });
      }
      const cleanTitle = title.trim().replace(/\s+/g, ' ');
      const cleanDescription = description.trim().replace(/\s+/g, ' ');
      const res = await api.post('/artworks', {
        title: cleanTitle,
        description: cleanDescription,
        image_path,
        materials: materials.split(',').map((s) => s.trim()).filter(Boolean),
        categories,
      });
      showToast(`"${res.data.artwork.title}" published to the gallery.`);
      navigate(`/artworks/${res.data.artwork._id}`);
    } catch (err) {
      showToast(err.response?.data?.message || err.message || 'Could not publish this artwork.', true);
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
          <label htmlFor="artwork-image">Artwork image <span className="optional-mark">(optional)</span></label>
          {/* image/* gives the native picker its normal "Image files" filter;
              handleImageChange and the API still enforce the supported formats. */}
          <input id="artwork-image" type="file" accept="image/*" onChange={handleImageChange} />
          <div className="hint">PNG, JPG/JPEG, WebP, or GIF only. Maximum 10 MB.</div>
          {preview && <img className="upload-preview" src={preview} alt="Artwork preview" />}
        </div>
        <div className="field">
          <label>Title <span className="required-mark" aria-hidden="true">*</span></label>
          <input
            maxLength={50}
            value={title}
            onChange={(e) => { setTitle(e.target.value); setTitleErr(false); }}
            placeholder="e.g. Sunset Dreams"
            style={titleErr ? { outline: '2px solid #C15656' } : undefined}
          />
          {titleErr && <div className="hint" style={{ color: '#A34848' }}>Give this piece a title before publishing.</div>}
        </div>
        <div className="field">
          <label>Description <span className="optional-mark">(optional)</span></label>
          <textarea maxLength={1000} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What is this piece about?" />
          <div className="hint">{description.length}/1000 characters</div>
        </div>
        <div className="field">
          <label>Categories <span className="optional-mark">(optional)</span></label>
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
          <label>Materials <span className="optional-mark">(optional)</span></label>
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
