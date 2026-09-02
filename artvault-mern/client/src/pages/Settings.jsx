import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import api from '../api';

const ALL_CATEGORIES = [
  'Digital Art', 'Illustration', 'Textile Art', 'Crafts', 'Photography',
  'Sculpture', 'Painting', 'Traditional Art', 'Mixed Media', 'Calligraphy',
];

export default function Settings() {
  const { user, updateUser } = useAuth();
  const showToast = useToast();

  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [specializations, setSpecializations] = useState([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (user) {
      setName(user.name || '');
      setBio(user.bio || '');
      setSpecializations(user.specializations || []);
    }
  }, [user]);

  function toggle(cat) {
    setSpecializations((s) => (s.includes(cat) ? s.filter((c) => c !== cat) : [...s, cat]));
    setSaved(false);
  }

  async function save() {
    setSaving(true);
    try {
      const res = await api.put('/artists/me', { name, bio, specializations });
      updateUser(res.data.artist);
      setSaved(true);
      showToast('Profile updated.');
    } catch (err) {
      showToast(err.response?.data?.message || 'Could not save changes.', true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section>
      <div className="page-head">
        <div>
          <div className="eyebrow">Account</div>
          <h1>Profile settings</h1>
          <div className="sub">This is what other visitors see on your artist profile.</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 32 }}>
        <div className="form-card">
          <div className="field">
            <label>Display name</label>
            <input value={name} onChange={(e) => { setName(e.target.value); setSaved(false); }} />
          </div>
          <div className="field">
            <label>Bio</label>
            <textarea value={bio} onChange={(e) => { setBio(e.target.value); setSaved(false); }} />
          </div>
          <div className="field">
            <label>Specializations</label>
            <div className="chip-select">
              {ALL_CATEGORIES.map((c) => (
                <button
                  type="button" key={c}
                  className={`chip-toggle${specializations.includes(c) ? ' on' : ''}`}
                  onClick={() => toggle(c)}
                >
                  {c}
                </button>
              ))}
            </div>
            <div className="hint">Shown as tags on your public profile.</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8 }}>
            <button className="btn btn-primary" onClick={save} disabled={saving}>
              {saving ? <span className="spinner" /> : null}
              {saving ? 'Saving…' : 'Save changes'}
            </button>
            {saved && <span style={{ fontSize: 12.5, color: '#3F8452' }}>✓ Saved</span>}
          </div>
        </div>

        <div>
          <div className="eyebrow">Public preview</div>
          <div className="artist-card" style={{ cursor: 'default' }}>
            <div className="av-lg">{(name || '?').slice(0, 2).toUpperCase()}</div>
            <div className="name">{name || 'Unnamed artist'}</div>
            <div className="bio">{bio}</div>
            <div className="tags">
              {specializations.map((s) => (
                <span className="tiny-tag" key={s}>{s}</span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
