import { useEffect, useState } from 'react';
import api from '../api';
import { useToast } from '../components/Toast';
import ConfirmDialog from '../components/ConfirmDialog';

function monthDay(dateStr) {
  const d = new Date(dateStr);
  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  return { day: d.getDate(), mon: months[d.getMonth()] };
}

const artworkId = (artwork) => String(artwork?._id || artwork || '');

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
    // Open immediately from the lightweight list response so the button never
    // feels unresponsive, then refresh the populated artwork IDs in place.
    setEditingId(ex._id);
    setForm({
      name: ex.name,
      description: ex.description || '',
      event_date: String(ex.event_date).slice(0, 10),
      artworks: (ex.artworks || []).map(artworkId).filter(Boolean),
    });
    setModalOpen(true);
    api.get(`/exhibits/${ex._id}`).then((response) => {
      const current = response.data.exhibit;
      if (!current || current._id !== ex._id) return;
      setForm((previous) => ({
        ...previous,
        artworks: (current.artworks || []).map(artworkId).filter(Boolean),
      }));
    }).catch(() => {
      // The lightweight list data is already usable; keep the modal open if
      // the optional refresh is unavailable.
    });
  }
  function toggleArtwork(id) {
    const normalizedId = artworkId(id);
    setForm((f) => ({
      ...f,
      artworks: f.artworks.map(String).includes(normalizedId)
        ? f.artworks.filter((x) => String(x) !== normalizedId)
        : [...f.artworks.map(String), normalizedId],
    }));
  }

  async function save() {
    if (!form.name.trim()) {
      showToast('Give the exhibit a name first.', true);
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...form,
        name: form.name.trim().replace(/\s+/g, ' '),
        description: form.description.trim().replace(/\s+/g, ' '),
      };
      if (editingId) {
        await api.put(`/exhibits/${editingId}`, payload);
      } else {
        await api.post('/exhibits', payload);
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

  const featuredCount = new Set(exhibits.flatMap((e) => (e.artworks || []).map(artworkId))).size;

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
          <div className="modal-box exhibit-modal-box">
            <div className="modal-head">
              <h2>{editingId ? 'Edit exhibit' : 'Create exhibit'}</h2>
              <button className="modal-close" onClick={() => setModalOpen(false)}>✕</button>
            </div>
            <div className="field">
              <label>Exhibit name <span className="required-mark" aria-hidden="true">*</span></label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Modern Art Showcase" />
            </div>
            <div className="field">
              <label>Description <span className="optional-mark">(optional)</span></label>
              <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="field">
              <label>Event date <span className="required-mark" aria-hidden="true">*</span></label>
              <input type="date" value={form.event_date} onChange={(e) => setForm({ ...form, event_date: e.target.value })} />
            </div>
            <div className="field">
              <label>Include artworks <span className="optional-mark">(optional)</span></label>
              <div className="checkbox-list">
                {artworks.map((w) => (
                  <label className="checkbox-row" key={w._id}>
                    <input
                      type="checkbox"
                      checked={form.artworks.map(String).includes(artworkId(w))}
                      onChange={() => toggleArtwork(w._id)}
                    />
                    <span className="exhibit-artwork-option">
                      {w.thumbnail_url && <img src={w.thumbnail_url} alt="" loading="lazy" decoding="async" />}
                      <span className="exhibit-artwork-copy">
                        <strong>{w.title}</strong>
                        <span className="exhibit-artwork-meta">{w.artist?.name || 'Unknown artist'} · {(w.categories || []).join(', ') || 'Uncategorized'}</span>
                      </span>
                    </span>
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
