import { useEffect, useState } from 'react';
import api from '../api';
import { useToast } from '../components/Toast';
import { useAuth } from '../context/AuthContext';
import ConfirmDialog from '../components/ConfirmDialog';

const specializations = [
  'Digital Art', 'Traditional Art', 'Painting', 'Illustration', 'Photography',
  'Sculpture', 'Crafts', 'Textile Art', 'Mixed Media', 'Calligraphy',
];

const blankForm = { name: '', bio: '', specializations: [] };

export default function ManageArtists() {
  const showToast = useToast();
  const { user } = useAuth();
  const [artists, setArtists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(blankForm);
  const [saving, setSaving] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [pendingRole, setPendingRole] = useState(null);

  function load() {
    setLoading(true);
    api.get('/artists/admin')
      .then((response) => setArtists(response.data.artists))
      .catch((error) => showToast(error.response?.data?.message || 'Could not load artist accounts.', true))
      .finally(() => setLoading(false));
  }
  useEffect(load, []);

  function openEdit(artist) {
    setEditing(artist);
    setForm({ name: artist.name, bio: artist.bio || '', specializations: artist.specializations || [] });
  }

  function toggleSpecialization(value) {
    setForm((current) => ({
      ...current,
      specializations: current.specializations.includes(value)
        ? current.specializations.filter((item) => item !== value)
        : [...current.specializations, value],
    }));
  }

  async function save() {
    if (!form.name.trim()) {
      showToast('Artist name is required.', true);
      return;
    }
    setSaving(true);
    try {
      await api.put(`/artists/admin/${editing._id}`, form);
      showToast(`${form.name} updated.`);
      setEditing(null);
      load();
    } catch (error) {
      showToast(error.response?.data?.message || 'Could not update this artist.', true);
    } finally {
      setSaving(false);
    }
  }

  async function remove(artist) {
    const warning = `Remove ${artist.name}'s account? Their artworks will also be removed from exhibits. This cannot be undone.`;
    setPendingDelete(artist);
  }

  async function confirmRemove() {
    const artist = pendingDelete;
    setPendingDelete(null);
    if (!artist) return;
    try {
      await api.delete(`/artists/admin/${artist._id}`);
      showToast(`${artist.name}'s account was removed.`);
      load();
    } catch (error) {
      showToast(error.response?.data?.message || 'Could not remove this artist.', true);
      }
  }

  async function changeRole(artist) {
    const nextRole = artist.role === 'sub_admin' ? 'artist' : 'sub_admin';
    setPendingRole({ artist, nextRole });
  }
  async function confirmRole() {
    const { artist, nextRole } = pendingRole || {}; setPendingRole(null); if (!artist) return;
    try {
      await api.put(`/artists/admin/${artist._id}/role`, { role: nextRole });
      showToast(nextRole === 'sub_admin' ? `${artist.name} is now a sub-admin.` : `${artist.name} is now an artist.`);
      load();
    } catch (error) {
      showToast(error.response?.data?.message || 'Could not change this account role.', true);
    }
  }

  return (
    <section>
      <div className="page-head">
        <div>
          <div className="eyebrow">Admin</div>
          <h1>Manage artists</h1>
          <div className="sub">Review artist accounts and maintain accurate public profiles.</div>
        </div>
      </div>

      <div className="stat-row">
        <div className="stat-box"><div className="num">{artists.length}</div><div className="lbl">Artist accounts</div></div>
        <div className="stat-box"><div className="num">{artists.filter((artist) => artist.bio).length}</div><div className="lbl">Profiles with bios</div></div>
        <div className="stat-box"><div className="num">{new Set(artists.flatMap((artist) => artist.specializations || [])).size}</div><div className="lbl">Represented disciplines</div></div>
      </div>

      {loading && <div className="empty">Loading artist accounts...</div>}
      {!loading && artists.length === 0 && <div className="empty">No artist accounts yet.</div>}
      {!loading && artists.length > 0 && (
        <div className="admin-list">
          {artists.map((artist) => (
            <article className="admin-artist-card" key={artist._id}>
              <div className="admin-artist-avatar">{artist.name.slice(0, 1).toUpperCase()}</div>
              <div className="admin-artist-info">
                <h2>{artist.name}</h2>
                <div className="mono admin-artist-email">{artist.email}</div>
                <div className="admin-artist-tags">
                  {(artist.specializations || []).length
                    ? artist.specializations.map((item) => <span className="tiny-tag" key={item}>{item}</span>)
                    : <span className="admin-muted">No disciplines selected</span>}
                </div>
              </div>
              <div className="exhibit-row-actions">
                <button className="btn btn-ghost btn-sm" type="button" onClick={() => openEdit(artist)}>Edit profile</button>
                {user?.role === 'main_admin' && <button className="btn btn-ghost btn-sm" type="button" onClick={() => changeRole(artist)}>{artist.role === 'sub_admin' ? 'Revoke sub-admin' : 'Make sub-admin'}</button>}
                <button className="btn btn-danger btn-sm" type="button" onClick={() => remove(artist)}>Remove</button>
              </div>
            </article>
          ))}
        </div>
      )}

      {editing && (
        <div className="modal-overlay" onClick={(event) => event.target === event.currentTarget && setEditing(null)}>
          <div className="modal-box">
            <div className="modal-head">
              <div><div className="eyebrow">Artist account</div><h2>Edit {editing.name}</h2></div>
              <button className="modal-close" type="button" aria-label="Close" onClick={() => setEditing(null)}>x</button>
            </div>
            <div className="field">
              <label>Display name</label>
              <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
            </div>
            <div className="field">
              <label>Bio</label>
              <textarea value={form.bio} onChange={(event) => setForm({ ...form, bio: event.target.value })} />
            </div>
            <div className="field">
              <label>Disciplines</label>
              <div className="chip-select">
                {specializations.map((item) => <button key={item} type="button" className={`chip-toggle${form.specializations.includes(item) ? ' on' : ''}`} onClick={() => toggleSpecialization(item)}>{item}</button>)}
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn btn-ghost" type="button" onClick={() => setEditing(null)}>Cancel</button>
              <button className="btn btn-primary" type="button" onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save changes'}</button>
            </div>
          </div>
        </div>
      )}
      {pendingDelete && <ConfirmDialog title="Archive artist account?" message={`“${pendingDelete.name}” and their artworks will be moved to Archives. You can restore them later.`} confirmLabel="Move to archives" danger onConfirm={confirmRemove} onCancel={() => setPendingDelete(null)} />}
      {pendingRole && <ConfirmDialog title={pendingRole.nextRole === 'sub_admin' ? 'Make sub-admin?' : 'Revoke sub-admin?'} message={`${pendingRole.artist.name} will ${pendingRole.nextRole === 'sub_admin' ? 'be allowed to manage gallery, exhibits, and users' : 'return to a regular artist account'}.`} confirmLabel="Continue" onConfirm={confirmRole} onCancel={() => setPendingRole(null)} />}
    </section>
  );
}
