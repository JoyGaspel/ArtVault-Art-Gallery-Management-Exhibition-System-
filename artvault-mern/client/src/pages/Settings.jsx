import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import ConfirmDialog from '../components/ConfirmDialog';
import api from '../api';

const ALL_CATEGORIES = [
  'Digital Art', 'Illustration', 'Textile Art', 'Crafts', 'Photography',
  'Sculpture', 'Painting', 'Traditional Art', 'Mixed Media', 'Calligraphy',
];

export default function Settings() {
  const { user, updateUser, updatePassword, updateEmail, logout } = useAuth();
  const showToast = useToast();

  const [name, setName] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [bio, setBio] = useState('');
  const [specializations, setSpecializations] = useState([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [accountSaving, setAccountSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [avatarPath, setAvatarPath] = useState('');

  useEffect(() => {
    if (user) {
      setName(user.name || '');
      setFirstName(user.firstName || user.name?.trim().split(/\s+/)[0] || '');
      setLastName(user.lastName || user.name?.trim().split(/\s+/).slice(1).join(' ') || '');
      setBio(user.bio || '');
      setSpecializations(user.specializations || []);
      setAvatarPath(user.avatar_path || '');
    }
  }, [user]);

  function toggle(cat) {
    setSpecializations((s) => (s.includes(cat) ? s.filter((c) => c !== cat) : [...s, cat]));
    setSaved(false);
  }

  async function save() {
    const cleanFirstName = firstName.trim().replace(/\s+/g, ' ');
    const cleanLastName = lastName.trim().replace(/\s+/g, ' ');
    const cleanBio = bio.trim().replace(/\s+/g, ' ');
    setSaving(true);
    try {
      const res = await api.put('/artists/me', { firstName: cleanFirstName, lastName: cleanLastName, bio: cleanBio, specializations, avatar_path: avatarPath });
      updateUser(res.data.artist);
      setName(res.data.artist.name);
      setFirstName(cleanFirstName);
      setLastName(cleanLastName);
      setBio(cleanBio);
      setSaved(true);
      showToast('Profile updated.');
    } catch (err) {
      showToast(err.response?.data?.message || 'Could not save changes.', true);
    } finally {
      setSaving(false);
    }
  }

  async function changeEmail() {
    const email = newEmail.trim().toLowerCase();
    if (!email || email === user.email.toLowerCase()) return showToast('Enter a different email address.', true);
    setAccountSaving(true);
    try {
      await updateEmail(email);
      setNewEmail('');
      showToast('Check your inbox to confirm the new email address.');
    } catch (err) { showToast(err.message || 'Could not change email.', true); }
    finally { setAccountSaving(false); }
  }

  async function changePassword() {
    if (newPassword.length < 8) return showToast('Password must be at least 8 characters.', true);
    if (newPassword !== confirmPassword) return showToast('Passwords do not match.', true);
    setAccountSaving(true);
    try {
      await updatePassword(newPassword);
      setNewPassword(''); setConfirmPassword('');
      showToast('Password updated successfully.');
    } catch (err) { showToast(err.message || 'Could not change password.', true); }
    finally { setAccountSaving(false); }
  }

  async function deleteAccount() {
    setConfirmDelete(true);
  }

  async function confirmAccountDeletion() {
    setConfirmDelete(false);
    setAccountSaving(true);
    try {
      await api.delete('/artists/me');
      logout();
    } catch (err) { showToast(err.response?.data?.message || 'Could not delete your account.', true); setAccountSaving(false); }
  }

  return (
    <section className="settings-section">
      <div className="page-head settings-page-head">
        <div>
          <div className="eyebrow">Account</div>
          <h1>Profile settings</h1>
          <div className="sub">This is what other visitors see on your artist profile.</div>
        </div>

        <div className="form-card account-security-card">
          <div className="eyebrow">Security</div>
          <h2>Account access</h2>
          <div className="field">
            <label htmlFor="new-email">Change email <span className="optional-mark">(optional)</span></label>
            <input id="new-email" type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder={user?.email || 'new@email.com'} />
            <div className="hint">A confirmation link will be sent before the new email is used.</div>
            <button className="btn btn-ghost btn-sm" type="button" onClick={changeEmail} disabled={accountSaving}>Update email</button>
          </div>
          <div className="field">
            <label htmlFor="new-password">New password <span className="optional-mark">(optional)</span></label>
            <div className="field-input-wrap">
              <input id="new-password" type={showNewPassword ? 'text' : 'password'} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="At least 8 characters" autoComplete="new-password" />
              <button type="button" className="field-show-toggle" onClick={() => setShowNewPassword((value) => !value)} aria-label={showNewPassword ? 'Hide password' : 'Show password'}>{showNewPassword ? 'Hide' : 'Show'}</button>
            </div>
          </div>
          <div className="field">
            <label htmlFor="confirm-new-password">Confirm new password <span className="optional-mark">(optional)</span></label>
            <div className="field-input-wrap">
              <input id="confirm-new-password" type={showConfirmPassword ? 'text' : 'password'} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Re-enter your password" autoComplete="new-password" />
              <button type="button" className="field-show-toggle" onClick={() => setShowConfirmPassword((value) => !value)} aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}>{showConfirmPassword ? 'Hide' : 'Show'}</button>
            </div>
            <button className="btn btn-ghost btn-sm" type="button" onClick={changePassword} disabled={accountSaving}>Update password</button>
          </div>
          <div className="account-danger-zone">
            <div><strong>Delete account</strong><div className="hint">Your artworks will be archived before deletion.</div></div>
            <button className="btn btn-danger btn-sm" type="button" onClick={deleteAccount} disabled={accountSaving}>Delete account</button>
          </div>
        </div>
      </div>

      <div className="settings-profile-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 32 }}>
        <div className="form-card">
          <div className="field">
            <label htmlFor="profile-picture">Profile picture <span className="optional-mark">(optional)</span></label>
            <input id="profile-picture" type="file" accept="image/*" onChange={(event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              if (!['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(file.type)) { showToast('Only PNG, JPG/JPEG, WebP, or GIF images are allowed.', true); event.target.value = ''; return; }
              if (file.size > 2 * 1024 * 1024) { showToast('Profile picture must be 2 MB or smaller.', true); event.target.value = ''; return; }
              const reader = new FileReader();
              reader.onload = () => { setAvatarPath(reader.result); setSaved(false); };
              reader.readAsDataURL(file);
            }} />
            <div className="hint">PNG, JPG/JPEG, WebP, or GIF only. Maximum 2 MB.</div>
          </div>
          <div className="field">
            <label>First name <span className="required-mark" aria-hidden="true">*</span></label>
            <input maxLength={50} value={firstName} onChange={(e) => { setFirstName(e.target.value); setSaved(false); }} />
            <div className="hint">At least 2 letters, starting with a capital letter.</div>
          </div>
          <div className="field">
            <label>Last name <span className="required-mark" aria-hidden="true">*</span></label>
            <input maxLength={50} value={lastName} onChange={(e) => { setLastName(e.target.value); setSaved(false); }} />
            <div className="hint">At least 2 letters, starting with a capital letter.</div>
          </div>
          <div className="field">
            <label>Bio <span className="optional-mark">(optional)</span></label>
            <textarea maxLength={50} value={bio} onChange={(e) => { setBio(e.target.value); setSaved(false); }} />
            <div className="hint">{bio.length}/50 characters</div>
          </div>
          <div className="field">
            <label>Specializations <span className="optional-mark">(optional)</span></label>
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
            {avatarPath ? <img className="profile-avatar-preview" src={avatarPath} alt="Profile preview" /> : <div className="av-lg">{(`${firstName} ${lastName}`.trim() || '?').slice(0, 2).toUpperCase()}</div>}
            <div className="name">{`${firstName} ${lastName}`.trim() || 'Unnamed artist'}</div>
            <div className="bio">{bio}</div>
            <div className="tags">
              {specializations.map((s) => (
                <span className="tiny-tag" key={s}>{s}</span>
              ))}
            </div>
          </div>
        </div>
      </div>
      {confirmDelete && (
        <ConfirmDialog
          title="Delete your account?"
          message="Your artworks will be moved to Archives before the account is permanently removed. This cannot be undone."
          confirmLabel="Delete account"
          danger
          onConfirm={confirmAccountDeletion}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    </section>
  );
}
