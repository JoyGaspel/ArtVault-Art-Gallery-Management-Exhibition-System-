import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { useToast } from '../components/Toast';
import { useAuth } from '../context/AuthContext';
import { createGalleryThumbnail, fileToDataUrl } from '../utils/imageProcessing';

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
  const [visibility, setVisibility] = useState('public');
  const [image, setImage] = useState(null);
  const [preview, setPreview] = useState('');
  const fileInputRef = useRef(null);

  function toggleCategory(cat) {
    setCategories((c) => (c.includes(cat) ? c.filter((x) => x !== cat) : [...c, cat]));
  }

  function handleImageChange(event) {
    const file = event.target.files?.[0];
    if (!file) { setImage(null); setPreview(''); return; }
    const extensionLooksValid = /\.(png|jpe?g|webp|gif)$/i.test(file.name);
    if ((file.type && !ALLOWED_IMAGE_TYPES.includes(file.type)) || !extensionLooksValid) {
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
    if (!file.size) {
      showToast('The selected image is empty. Choose another file.', true);
      event.target.value = '';
      return;
    }
    if (preview) URL.revokeObjectURL(preview);
    setImage(file);
    setPreview(URL.createObjectURL(file));
  }

  function removeImage() {
    if (preview) URL.revokeObjectURL(preview);
    setImage(null);
    setPreview('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  async function publish() {
    if (saving) return;
    if (!title.trim()) {
      setTitleErr(true);
      showToast('Give this artwork a title before saving.', true);
      return;
    }
    if (title.trim().length > 50 || description.trim().length > 1000) {
      showToast('Title must be 50 characters or fewer, and description 1,000 or fewer.', true);
      return;
    }
    if (!categories.length || categories.length > 5) {
      showToast('Choose between 1 and 5 artwork categories.', true);
      return;
    }
    const materialList = materials.split(',').map((s) => s.trim()).filter(Boolean);
    if (materialList.length > 20 || materialList.some((item) => item.length > 80)) {
      showToast('Use at most 20 materials, each 80 characters or fewer.', true);
      return;
    }
    if (image && ((image.type && !ALLOWED_IMAGE_TYPES.includes(image.type)) || image.size > MAX_IMAGE_BYTES || !image.size)) {
      showToast('Choose a valid image up to 10 MB.', true);
      return;
    }
    setSaving(true);
    try {
      let image_path = '';
      if (image) {
        image_path = await fileToDataUrl(image);
      }
      const thumbnail_path = image ? await createGalleryThumbnail(image) : '';
      const cleanTitle = title.trim().replace(/\s+/g, ' ');
      const cleanDescription = description.trim().replace(/\s+/g, ' ');
      const res = await api.post('/artworks', {
        title: cleanTitle,
        description: cleanDescription,
        image_path,
        thumbnail_path,
        materials: materialList,
        categories,
        visibility,
      });
      showToast(visibility === 'private' ? `"${res.data.artwork.title}" saved to your Vault.` : `"${res.data.artwork.title}" published to the gallery.`);
      navigate(visibility === 'private' ? '/vault' : `/artworks/${res.data.artwork._id}`);
    } catch (err) {
      showToast(err.response?.data?.message || err.message || 'Could not publish this artwork.', true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="upload-page">
      <div className="page-head">
        <div>
          <div className="eyebrow">ARTIST STUDIO · NEW WORK</div>
          <h1>Upload an artwork</h1>
          <div className="sub">Add a new piece to your portfolio and the public gallery.</div>
        </div>
      </div>

      <div className="form-card upload-form-card">
        <div className="field">
          <label htmlFor="artwork-image">Artwork image <span className="optional-mark">(optional)</span></label>
          {/* image/* gives the native picker its normal "Image files" filter;
              handleImageChange and the API still enforce the supported formats. */}
          <input className="file-input" ref={fileInputRef} id="artwork-image" type="file" accept="image/*" onChange={handleImageChange} />
          <div className="hint">PNG, JPG/JPEG, WebP, or GIF only. Maximum 10 MB.</div>
          {preview && (
            <div className="upload-preview-wrap">
              <img className="upload-preview" src={preview} alt="Artwork preview" />
              <button type="button" className="upload-preview-remove" onClick={removeImage} aria-label="Remove selected artwork image" title="Remove selected image">×</button>
            </div>
          )}
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
          <div className="hint">Separate materials with commas; maximum 20, each up to 80 characters.</div>
        </div>

        <div className="vault-upload-choice" role="group" aria-label="Artwork visibility">
            <label><input type="radio" name="artwork-visibility" checked={visibility === 'public'} onChange={() => setVisibility('public')} /> Public gallery</label>
            <label><input type="radio" name="artwork-visibility" checked={visibility === 'private'} onChange={() => setVisibility('private')} /> Save privately to my Vault</label>
            <small>Vault artworks are visible only to you, sub-admins, and the main administrator.</small>
        </div>
        <div className="form-actions">
          <button className="btn btn-primary" onClick={publish} disabled={saving}>
            {saving ? <span className="spinner" /> : null}
            {saving ? 'Saving…' : visibility === 'private' ? 'Save to Vault' : 'Publish artwork'}
          </button>
          <button className="btn btn-ghost" onClick={() => navigate('/')}>Cancel</button>
        </div>
      </div>
    </section>
  );
}
