import { useEffect, useState } from 'react';
import api from '../api';
import { useToast } from '../components/Toast';
import ConfirmDialog from '../components/ConfirmDialog';

function monthDay(dateStr) {
  const d = new Date(dateStr);
  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  return { day: d.getDate(), mon: months[d.getMonth()] };
}

const emptyForm = { name: '', description: '', event_date: '', artworks: [] };

export default function ManageExhibits() {
  const showToast = useToast();
  const [exhibits, setExhibits] = useState([]);
  const [artworks, setArtworks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null);

  function load() {
    setLoading(true);
    Promise.all([api.get('/exhibits'), api.get('/artworks', { params: { limit: 100 } })])
      .then(([exRes, artRes]) => {
        setExhibits(exRes.data.exhibits);
        setArtworks(artRes.data.artworks);
      })
      .finally(() => setLoading(false));
  }
  useEffect(load, []);

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setModalOpen(true);
  }
  function openEdit(ex) {
    setEditingId(ex._id);
    setForm({
      name: ex.name,
      description: ex.description,
      event_date: ex.event_date.slice(0, 10),
      artworks: ex.artworks.map((w) => w._id),
    });
    setModalOpen(true);
  }
  function toggleArtwork(id) {
    setForm((f) => ({
      ...f,
      artworks: f.artworks.includes(id) ? f.artworks.filter((x) => x !== id) : [...f.artworks, id],
    }));
  }

  async function save() {
    if (!form.name.trim()) {
      showToast('Give the exhibit a name first.', true);
      return;
    }
    setSaving(true);
    try {
      if (editingId) {
        await api.put(`/exhibits/${editingId}`, form);
      } else {
        await api.post('/exhibits', form);
      }
      showToast(`Exhibit "${form.name}" saved.`);
      setModalOpen(false);
      load();
    } catch (err) {
      showToast(err.response?.data?.message || 'Could not save this exhibit.', true);
    } finally {
      setSaving(false);
    }
  }

  async function remove(ex) {
    setPendingDelete(ex);
  }
  async function confirmRemove() {
    const ex = pendingDelete; setPendingDelete(null); if (!ex) return;
    try {
      await api.delete(`/exhibits/${ex._id}`);
      showToast(`Exhibit "${ex.name}" deleted.`);
      load();
    } catch (err) {
      showToast(err.response?.data?.message || 'Could not delete this exhibit.', true);
    }
  }

  const featuredCount = new Set(exhibits.flatMap((e) => e.artworks.map((w) => w._id))).size;

  return (
    <section>
      <div className="page-head">
        <div>
          <div className="eyebrow">Admin</div>
          <h1>Manage exhibits</h1>
          <div className="sub">Create shows and choose which artworks appear in each.</div>
        </div>
        <button className="btn btn-primary" onClick={openCreate}>+ Create exhibit</button>
      </div>

      <div className="stat-row">
        <div className="stat-box"><div className="num">{exhibits.length}</div><div className="lbl">Active exhibits</div></div>
        <div className="stat-box"><div className="num">{featuredCount}</div><div className="lbl">Artworks featured</div></div>
        <div className="stat-box"><div className="num">{artworks.length}</div><div className="lbl">Published artworks</div></div>
      </div>

      {loading && <div className="empty">Loading…</div>}
      {!loading && exhibits.length === 0 && <div className="empty">No exhibits yet. Create your first one.</div>}
      {!loading && exhibits.length > 0 && (
        <div className="exhibit-list">
          {exhibits.map((ex) => {
            const md = monthDay(ex.event_date);
            return (
              <div className="exhibit-card" key={ex._id} style={{ cursor: 'default' }}>
                <div className="exhibit-date"><div className="day">{md.day}</div><div className="mon">{md.mon}</div></div>
                <div className="exhibit-info">
                  <div className="name">{ex.name}</div>
                  <div className="desc">{ex.description} · {ex.artworks.length} pieces</div>
                </div>
                <div className="exhibit-row-actions">
                  <button className="btn btn-ghost btn-sm" onClick={() => openEdit(ex)}>Edit</button>
                  <button className="btn btn-danger btn-sm" onClick={() => remove(ex)}>Delete</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {modalOpen && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setModalOpen(false)}>
          <div className="modal-box">
            <div className="modal-head">
              <h2>{editingId ? 'Edit exhibit' : 'Create exhibit'}</h2>
              <button className="modal-close" onClick={() => setModalOpen(false)}>✕</button>
            </div>
            <div className="field">
              <label>Exhibit name</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Modern Art Showcase" />
            </div>
            <div className="field">
              <label>Description</label>
              <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="field">
              <label>Event date</label>
              <input type="date" value={form.event_date} onChange={(e) => setForm({ ...form, event_date: e.target.value })} />
            </div>
            <div className="field">
              <label>Include artworks</label>
              <div className="checkbox-list">
                {artworks.map((w) => (
                  <label className="checkbox-row" key={w._id}>
                    <input
                      type="checkbox"
                      checked={form.artworks.includes(w._id)}
                      onChange={() => toggleArtwork(w._id)}
                    />
                    <span>{w.title} — <span className="mono" style={{ fontSize: 11, color: 'var(--ink-faint)' }}>{w.artist?.name}</span></span>
                  </label>
                ))}
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setModalOpen(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={save} disabled={saving}>
                {saving ? <span className="spinner" /> : null}
                {saving ? 'Saving…' : 'Save exhibit'}
              </button>
            </div>
          </div>
        </div>
      )}
      {pendingDelete && <ConfirmDialog title="Archive exhibit?" message={`“${pendingDelete.name}” will be moved to Archives. You can restore it later.`} confirmLabel="Move to archives" danger onConfirm={confirmRemove} onCancel={() => setPendingDelete(null)} />}
    </section>
  );
}
