import { useEffect, useMemo, useState } from 'react';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';

const THREE_DAYS = 3 * 24 * 60 * 60 * 1000;
const deadline = (exhibit) => new Date(new Date(exhibit.event_date).getTime() - THREE_DAYS);
const formatDate = (value) => new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

export default function ExhibitSubmissions() {
  const { user } = useAuth(); const showToast = useToast();
  const [exhibits, setExhibits] = useState([]), [artworks, setArtworks] = useState([]), [entries, setEntries] = useState([]), [choices, setChoices] = useState({}), [loading, setLoading] = useState(true), [saving, setSaving] = useState('');
  async function load() {
    setLoading(true);
    try { const [exhibitResponse, artworkResponse, entryResponse] = await Promise.all([api.get('/exhibits'), api.get('/artworks/mine', { params: { limit: 100 } }), api.get('/exhibit-entries/my')]); setExhibits(exhibitResponse.data.exhibits || []); setArtworks(artworkResponse.data.artworks || []); setEntries(entryResponse.data.entries || []); }
    catch (error) { showToast(error.response?.data?.message || 'Could not load exhibit submissions.', true); }
    finally { setLoading(false); }
  }
  useEffect(() => { if (user?.id) load(); }, [user?.id]);
  const upcomingExhibits = useMemo(() => exhibits.filter((exhibit) => new Date(exhibit.event_date).getTime() > Date.now()), [exhibits]);
  const existingFor = (exhibitId, artworkId) => entries.find((entry) => String(entry.exhibit?._id || entry.exhibit) === String(exhibitId) && String(entry.artwork?._id || entry.artwork) === String(artworkId));
  async function submit(exhibit) {
    const artworkId = choices[exhibit._id]; if (!artworkId) return showToast('Choose one of your artworks first.', true);
    const key = `${exhibit._id}:${artworkId}`; setSaving(key);
    try { await api.post('/exhibit-entries', { exhibit: exhibit._id, artwork: artworkId }); showToast('Entry submitted for admin review.'); await load(); }
    catch (error) { showToast(error.response?.data?.message || 'Could not submit this entry.', true); } finally { setSaving(''); }
  }
  return <section className="submission-page">
    <div className="page-head"><div><div className="eyebrow">Artist studio · opportunities</div><h1>Exhibit submissions</h1><div className="sub">Send your own artwork to an upcoming exhibit for curator review.</div></div></div>
    {loading && <div className="empty">Loading exhibit opportunities…</div>}
    {!loading && upcomingExhibits.length === 0 && <div className="empty submission-empty"><strong>No upcoming exhibits yet.</strong><span>Check back when a new exhibit is scheduled.</span></div>}
    {!loading && upcomingExhibits.length > 0 && <div className="submission-opportunity-grid">{upcomingExhibits.map((exhibit) => {
      const isOpen = Date.now() < deadline(exhibit).getTime(); const selected = choices[exhibit._id] || ''; const existing = selected ? existingFor(exhibit._id, selected) : null; const key = `${exhibit._id}:${selected}`;
      const usedIds = new Set((exhibit.artworks || []).map((artwork) => String(artwork._id || artwork)));
      const exhibitEntries = entries.filter((entry) => String(entry.exhibit?._id || entry.exhibit) === String(exhibit._id));
      const blockedIds = new Set(exhibitEntries.filter((entry) => entry.status === 'approved' || entry.status === 'pending').map((entry) => String(entry.artwork?._id || entry.artwork)));
      exhibitEntries.filter((entry) => entry.status === 'denied' && (entry.attempts_used || 0) >= 2).forEach((entry) => blockedIds.add(String(entry.artwork?._id || entry.artwork)));
      const availableArtworks = artworks.filter((artwork) => !usedIds.has(String(artwork._id)) && !blockedIds.has(String(artwork._id)));
      const selectedArtwork = artworks.find((artwork) => String(artwork._id) === String(selected));
      return <article className="submission-opportunity-card" key={exhibit._id}>
        <div className="eyebrow">{isOpen ? `Open for entries · closes ${formatDate(deadline(exhibit))}` : 'Entries closed · review in progress'}</div><h2>{exhibit.name}</h2><p>{exhibit.description || 'A curated ArtVault exhibition.'}</p><div className="submission-meta">Event date · {formatDate(exhibit.event_date)}</div><div className="submission-availability">{availableArtworks.length} artwork{availableArtworks.length === 1 ? '' : 's'} available to you</div>
        <div className="submission-select-label">Choose your artwork</div>
        <div className="submission-artwork-picker" role="listbox" aria-label={`Artwork options for ${exhibit.name}`}>
          {!isOpen && <div className="submission-picker-empty">Submissions are closed</div>}
          {isOpen && !availableArtworks.length && <div className="submission-picker-empty">No eligible artworks available</div>}
          {isOpen && availableArtworks.map((artwork) => { const denied = exhibitEntries.find((entry) => String(entry.artwork?._id || entry.artwork) === String(artwork._id) && entry.status === 'denied'); const isSelected = String(selected) === String(artwork._id); return <button className={`submission-artwork-option${isSelected ? ' selected' : ''}`} key={artwork._id} type="button" role="option" aria-selected={isSelected} onClick={() => setChoices((current) => ({ ...current, [exhibit._id]: artwork._id }))}><span className="submission-artwork-option-title">{artwork.title}</span><span className="submission-artwork-option-meta">{(artwork.categories || []).join(' · ') || 'Uncategorized'}</span>{denied && <span className="submission-retry-badge">1 retry remaining</span>}</button>; })}
        </div>
        {selectedArtwork && <div className="submission-artwork-details"><strong>{selectedArtwork.title}</strong><span>{(selectedArtwork.categories || []).join(' · ') || 'Uncategorized'}</span><span>{(selectedArtwork.materials || []).join(', ') || 'Materials not specified'} · uploaded {formatDate(selectedArtwork.created_at)}</span></div>}
        {!selected && availableArtworks.length === 0 && isOpen && <div className="submission-no-artworks">All of your artworks are already submitted to or included in this exhibit.</div>}
        {existing && <div className={`submission-inline-status ${existing.status}`}>Already submitted ({existing.status})</div>}
        <button className="btn btn-primary submission-submit-btn" type="button" disabled={!isOpen || !selected || Boolean(existing) || saving === key} onClick={() => submit(exhibit)}>{saving === key ? 'Submitting…' : 'Submit for review'}</button>
      </article>;
    })}</div>}
  </section>;
}
