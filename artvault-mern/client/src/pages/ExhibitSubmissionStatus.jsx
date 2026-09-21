import { useEffect, useMemo, useState } from 'react';
import api from '../api';
import { useToast } from '../components/Toast';

const labels = { pending: 'Pending review', approved: 'Approved', denied: 'Denied', withdrawn: 'Withdrawn' };
const formatDate = (value) => new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

export default function ExhibitSubmissionStatus() {
  const showToast = useToast();
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState('');
  const groups = useMemo(() => ['pending', 'approved', 'denied', 'withdrawn'].map((status) => ({ status, items: entries.filter((entry) => entry.status === status) })).filter((group) => group.items.length), [entries]);

  useEffect(() => {
    api.get('/exhibit-entries/my').then((response) => setEntries(response.data.entries || []))
      .catch((error) => showToast(error.response?.data?.message || 'Could not load submission status.', true))
      .finally(() => setLoading(false));
  }, []);

  async function withdraw(entry) {
    setSaving(entry._id);
    try { await api.delete(`/exhibit-entries/${entry._id}`); setEntries((current) => current.map((item) => item._id === entry._id ? { ...item, status: 'withdrawn' } : item)); showToast('Submission withdrawn.'); }
    catch (error) { showToast(error.response?.data?.message || 'Could not withdraw this submission.', true); }
    finally { setSaving(''); }
  }

  return <section className="submission-page">
    <div className="page-head"><div><div className="eyebrow">Artist studio · tracking</div><h1>Exhibit submission status</h1><div className="sub">Follow the review progress of every artwork you submitted.</div></div></div>
    {loading && <div className="empty">Loading submission status…</div>}
    {!loading && !groups.length && <div className="empty submission-empty"><strong>No submissions yet.</strong><span>Your submitted artworks and review decisions will appear here.</span></div>}
    {!loading && groups.length > 0 && <div className="submission-status-groups">{groups.map((group) => <section className={`submission-status-group ${group.status}`} key={group.status}><div className="submission-group-heading"><h2>{labels[group.status]}</h2><span>{group.items.length} {group.items.length === 1 ? 'entry' : 'entries'}</span></div><div className="submission-status-list">{group.items.map((entry) => <article className="submission-status-card" key={entry._id}><div><strong>{entry.artwork?.title || 'Artwork'}</strong><span>{entry.exhibit?.name || 'Exhibit'} · submitted {formatDate(entry.createdAt)}{entry.attempt_number ? ` · attempt ${entry.attempt_number} of 2` : ''}{entry.status === 'denied' && entry.retries_remaining > 0 ? ` · ${entry.retries_remaining} retry remaining` : ''}</span>{entry.status === 'denied' && entry.denial_reason && <small className="submission-denial">Reason: {entry.denial_reason}</small>}</div><div className={`submission-status-pill ${entry.status}`}>{labels[entry.status] || entry.status}</div>{entry.status === 'pending' && <button className="btn btn-ghost btn-sm" type="button" onClick={() => withdraw(entry)} disabled={saving === entry._id}>{saving === entry._id ? 'Withdrawing…' : 'Withdraw'}</button>}</article>)}</div></section>)}</div>}
  </section>;
}
