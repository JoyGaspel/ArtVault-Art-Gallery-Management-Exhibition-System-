import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { useToast } from '../components/Toast';
import { useAuth } from '../context/AuthContext';
import { createGalleryThumbnail, fileToDataUrl } from '../utils/imageProcessing';
import { materialError } from '../utils/materialValidation';
import { appendMaterial, suggestedMaterials } from '../utils/materialSuggestions';

const ALL_CATEGORIES = [
  'Digital Art', 'Illustration', 'Textile Art', 'Crafts', 'Photography',
  'Sculpture', 'Painting', 'Traditional Art', 'Mixed Media', 'Calligraphy',
];
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/pjpeg', 'image/webp', 'image/gif'];

export default function Upload() {
  const navigate = useNavigate();
  const showToast = useToast();
  const { user } = useAuth();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [materials, setMaterials] = useState('');
  const [materialsTouched, setMaterialsTouched] = useState(false);
  const [categories, setCategories] = useState(['Digital Art']);
  const [titleErr, setTitleErr] = useState(false);
  const [saving, setSaving] = useState(false);
  const [visibility, setVisibility] = useState('');
  const [ownershipDeclared, setOwnershipDeclared] = useState(false);
  const [image, setImage] = useState(null);
  const [ownershipEvidence, setOwnershipEvidence] = useState(null);
  const [preview, setPreview] = useState('');
  const fileInputRef = useRef(null);
  const evidenceInputRef = useRef(null);

  function toggleCategory(cat) {
    if (!categories.includes(cat) && categories.length >= 5) {
      showToast('Choose no more than 5 categories.', true);
      return;
    }
    setCategories((c) => (c.includes(cat) ? c.filter((x) => x !== cat) : [...c, cat]));
  }

  function handleImageChange(event) {
    const file = event.target.files?.[0];
    if (!file) { setImage(null); setPreview(''); return; }
    const extensionLooksValid = /\.(png|jpe?g|jpe|webp|gif)$/i.test(file.name);
    if ((file.type && !ALLOWED_IMAGE_TYPES.includes(file.type)) || !extensionLooksValid) {
      if (preview) URL.revokeObjectURL(preview);
      setImage(null);
      setPreview('');
      showToast('Only PNG, JPG/JPEG/JPE, WebP, or GIF images are allowed.', true);
      event.target.value = '';
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      if (preview) URL.revokeObjectURL(preview);
      setImage(null);
      setPreview('');
      showToast('Image must be 10 MB or smaller.', true);
      event.target.value = '';
      return;
    }
    if (!file.size) {
      if (preview) URL.revokeObjectURL(preview);
      setImage(null);
      setPreview('');
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

  function handleEvidenceChange(event) {
    const file = event.target.files?.[0];
    if (!file) { setOwnershipEvidence(null); return; }
    if (!/\.(png|jpe?g|webp|gif)$/i.test(file.name) || (file.type && !ALLOWED_IMAGE_TYPES.includes(file.type)) || !file.size || file.size > 5 * 1024 * 1024) {
      setOwnershipEvidence(null);
      event.target.value = '';
      showToast('Choose a PNG, JPG/JPEG/JPE, WebP, or GIF proof image up to 5 MB.', true);
      return;
    }
    setOwnershipEvidence(file);
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
    if (!['public', 'private'].includes(visibility)) {
      showToast('Choose Public gallery or Save privately to my Vault before saving.', true);
      return;
    }
    if (!ownershipDeclared) {
      showToast('Confirm that you created this artwork or have permission to display it on ArtVault.', true);
      return;
    }
    if (!ownershipEvidence) {
      showToast('Add one private proof image, such as a sketch, work-in-progress photo, editing screenshot, or permission note.', true);
      evidenceInputRef.current?.focus();
      return;
    }
    const materialList = materials.split(',').map((s) => s.trim()).filter(Boolean);
    const materialsIssue = materialError(materials);
    if (materialsIssue) {
      setMaterialsTouched(true);
      showToast(materialsIssue, true);
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
      const ownership_evidence_path = await createGalleryThumbnail(ownershipEvidence, 1000);
      const cleanTitle = title.trim().replace(/\s+/g, ' ');
      const cleanDescription = description.trim().replace(/\s+/g, ' ');
      const res = await api.post('/artworks', {
        title: cleanTitle,
        description: cleanDescription,
        image_path,
        thumbnail_path,
        ownership_evidence_path,
        materials: materialList,
        categories,
        visibility,
        ownershipDeclared,
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
          <div className="sub">Add a new piece to your portfolio, then choose whether to publish it or keep it in your Vault.</div>
        </div>
      </div>

      <div className="form-card upload-form-card">
        <div className="field">
          <label htmlFor="artwork-image">Artwork image <span className="optional-mark">(optional)</span></label>
          <input className="file-input" ref={fileInputRef} id="artwork-image" type="file" accept=".png,.jpg,.jpeg,.jpe,.webp,.gif,image/png,image/jpeg,image/webp,image/gif" onChange={handleImageChange} />
          <div className="hint">PNG, JPG/JPEG/JPE, WebP, or GIF only. Maximum 10 MB.</div>
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
          <label>Categories <span className="required-mark" aria-hidden="true">*</span></label>
          <div className="chip-select">
            {ALL_CATEGORIES.map((c) => (
              <button
                type="button" key={c}
                className={`chip-toggle${categories.includes(c) ? ' on' : ''}`}
                onClick={() => toggleCategory(c)}
                disabled={categories.length >= 5 && !categories.includes(c)}
              >
                {c}
              </button>
            ))}
          </div>
          <div className="hint">Choose 1 to 5 categories. At least one is required.</div>
        </div>
        <div className="field">
          <label>Materials <span className="optional-mark">(optional)</span></label>
          <div className="material-input-row">
            <input value={materials} onChange={(e) => setMaterials(e.target.value)} onBlur={() => setMaterialsTouched(true)} aria-invalid={materialsTouched && Boolean(materialError(materials))} aria-describedby="upload-materials-help" placeholder="e.g. Cotton thread, natural dye" />
            <select aria-label="Add a suggested material" value="" onChange={(e) => { setMaterials((current) => appendMaterial(current, e.target.value)); setMaterialsTouched(true); }}>
              <option value="">Suggestions</option>
              {suggestedMaterials(categories).map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </div>
          <div className="hint" id="upload-materials-help">{materialsTouched && materialError(materials) ? materialError(materials) : 'Separate real material names with commas; custom materials are welcome. Maximum 20, each up to 80 characters.'}</div>
        </div>

        <div className="vault-upload-choice" role="group" aria-label="Artwork visibility, required">
            <label><input type="radio" name="artwork-visibility" checked={visibility === 'public'} onChange={() => setVisibility('public')} /> Public gallery</label>
            <label><input type="radio" name="artwork-visibility" checked={visibility === 'private'} onChange={() => setVisibility('private')} /> Save privately to my Vault</label>
            <small>Choose where to save your artwork before continuing.</small>
        </div>
        <label className="artwork-ownership-choice">
          <input type="checkbox" checked={ownershipDeclared} onChange={(event) => setOwnershipDeclared(event.target.checked)} />
          <span>I created this artwork or have permission to display it on ArtVault. <span className="required-mark" aria-hidden="true">*</span></span>
        </label>
        <div className="field ownership-evidence-field">
          <label htmlFor="ownership-evidence">Private ownership proof <span className="required-mark" aria-hidden="true">*</span></label>
          <input ref={evidenceInputRef} id="ownership-evidence" className="file-input" type="file" accept=".png,.jpg,.jpeg,.jpe,.webp,.gif,image/png,image/jpeg,image/webp,image/gif" onChange={handleEvidenceChange} required />
          <div className="hint">One sketch, work-in-progress photo, editing/layer screenshot, or permission note. Image only, up to 5 MB. Visible to you and ArtVault administrators—not in the public gallery. This helps review your claim but does not verify it automatically.</div>
          {ownershipEvidence && <div className="hint">Selected: {ownershipEvidence.name}</div>}
        </div>
        <div className="form-actions upload-actions">
          <button className="btn btn-primary" type="button" onClick={publish} disabled={saving}>
            {saving ? <span className="spinner" /> : null}
            {saving ? 'Saving…' : visibility === 'private' ? 'Save to Vault' : visibility === 'public' ? 'Publish artwork' : 'Choose where to save'}
          </button>
          <button className="btn btn-ghost" type="button" onClick={() => navigate('/')} disabled={saving}>Cancel</button>
        </div>
      </div>
    </section>
  );
}
