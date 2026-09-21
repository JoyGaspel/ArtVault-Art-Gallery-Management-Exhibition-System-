import { useEffect, useState } from 'react';
import api from '../api';
import { useToast } from '../components/Toast';

const formatDate = (value) => value ? new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '';

export default function ManageExhibitEntries() {
  const showToast = useToast();
  const [entries, setEntries] = useState([]), [filter, setFilter] = useState('pending'), [loading, setLoading] = useState(true), [saving, setSaving] = useState('');
  const [denying, setDenying] = useState(null), [reason, setReason] = useState('');
  async function load() {
    setLoading(true); try { const response = await api.get('/exhibit-entries/review', { params: filter === 'all' ? {} : { status: filter } }); setEntries(response.data.entries || []); }
    catch (error) { showToast(error.response?.data?.message || 'Could not load exhibit entries.', true); } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, [filter]);
  async function decide(entry, status, denial_reason = '') {
    setSaving(entry._id); try { await api.put(`/exhibit-entries/${entry._id}/decision`, { status, denial_reason }); showToast(status === 'approved' ? 'Entry approved for the exhibit.' : 'Entry denied.'); setDenying(null); setReason(''); await load(); }
    catch (error) { showToast(error.response?.data?.message || 'Could not update this entry.', true); } finally { setSaving(''); }
  }
  return <section className="submission-page">
    <div className="page-head"><div><div className="eyebrow">Curation · review queue</div><h1>Exhibit entries</h1><div className="sub">Review artist submissions before they appear in an exhibit.</div></div></div>
    <div className="submission-filter-row" role="tablist" aria-label="Submission status">{['pending', 'approved', 'denied', 'withdrawn', 'all'].map((status) => <button key={status} type="button" className={`chip-toggle${filter === status ? ' on' : ''}`} onClick={() => setFilter(status)}>{status[0].toUpperCase() + status.slice(1)}</button>)}</div>
    {loading && <div className="empty">Loading submissions…</div>}{!loading && entries.length === 0 && <div className="empty">No {filter === 'all' ? '' : filter} submissions.</div>}
    {!loading && entries.length > 0 && <div className="submission-review-list">{entries.map((entry) => <article className="submission-review-card" key={entry._id}>
      <div className="submission-review-main"><div className="eyebrow">{entry.exhibit?.name || 'Exhibit'} · {formatDate(entry.exhibit?.event_date)}</div><h2>{entry.artwork?.title || 'Artwork'}</h2><p>Submitted by <strong>{entry.artist?.name || 'Artist'}</strong> · {formatDate(entry.createdAt)}</p>{entry.status === 'denied' && entry.denial_reason && <div className="submission-denial">Reason: {entry.denial_reason}</div>}</div>
      <div className="submission-review-actions"><span className={`submission-status-pill ${entry.status}`}>{entry.status}</span>{entry.status === 'pending' && <><button className="btn btn-primary btn-sm" type="button" onClick={() => decide(entry, 'approved')} disabled={saving === entry._id}>Approve</button><button className="btn btn-danger btn-sm" type="button" onClick={() => { setDenying(entry); setReason(''); }} disabled={saving === entry._id}>Deny</button></>}</div>
      {denying?._id === entry._id && <div className="submission-deny-form"><label htmlFor={`deny-reason-${entry._id}`}>Reason for denial</label><textarea id={`deny-reason-${entry._id}`} value={reason} maxLength={500} onChange={(event) => setReason(event.target.value)} placeholder="Explain what the artist should improve…" /><div className="modal-actions"><button className="btn btn-ghost btn-sm" type="button" onClick={() => setDenying(null)}>Cancel</button><button className="btn btn-danger btn-sm" type="button" disabled={!reason.trim() || saving === entry._id} onClick={() => decide(entry, 'denied', reason.trim())}>Confirm denial</button></div></div>}
    </article>)}</div>}
  </section>;
}
