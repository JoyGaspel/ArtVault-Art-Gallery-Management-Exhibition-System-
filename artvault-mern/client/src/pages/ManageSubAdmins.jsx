import { useEffect, useState } from 'react';
import api from '../api';
import useAutoRefresh from '../hooks/useAutoRefresh';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import RoleChangeDialog from '../components/RoleChangeDialog';
import PageLoadState from '../components/PageLoadState';

export default function ManageSubAdmins() {
  const { user } = useAuth();
  const toast = useToast();
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [adding, setAdding] = useState(false);
  const [search, setSearch] = useState('');
  function load({ silent = false } = {}) {
    if (!silent) { setLoading(true); setError(''); }
    return api.get('/artists/admin').then((response) => {
      const artists = response.data.artists || [];
      setAccounts(artists.filter((artist) => artist.role === 'sub_admin'));
      setCandidates(artists.filter((artist) => artist.role === 'artist' && artist.status === 'active'));
    })
      .then(() => setError(''))
      .catch((error) => { const message = error.response?.data?.message || 'Could not load sub-admins.'; if (!silent) { setError(message); toast(message, true); } }).finally(() => { if (!silent) setLoading(false); });
  }
  useEffect(() => { load(); }, []);
  useAutoRefresh(() => load({ silent: true }));
  if (user?.role !== 'main_admin') return <div className="empty">Only the main administrator can manage sub-admins.</div>;
  return <section>
    <div className="page-head"><div><div className="eyebrow">Administration</div><h1>Manage sub-admins</h1><div className="sub">Promote existing artists or revoke elevated access. Each change requires Main Admin email verification.</div></div><button type="button" className="btn btn-primary" disabled={loading || Boolean(error)} onClick={() => { setAdding(!adding); setSearch(''); }}>{adding ? 'Close artist selection' : 'Add sub-admin'}</button></div>
    <div className="stat-row"><div className="stat-box"><div className="num">{accounts.length}</div><div className="lbl">Sub-admin accounts</div></div></div>
    {adding && !error && <div className="form-card" style={{ maxWidth: 'none', marginBottom: 20 }}>
      <h2>Select an artist to promote</h2><p className="hint">Choose an active Artist account. Existing accounts are promoted; no duplicate account is created.</p>
      <div className="field"><label htmlFor="sub-admin-artist-search">Search artists by name or email</label><input id="sub-admin-artist-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Artist name or email" /></div>
      <div className="admin-list">{candidates.filter((artist) => `${artist.name} ${artist.email}`.toLowerCase().includes(search.trim().toLowerCase())).map((artist) => <article className="admin-artist-card" key={artist._id}><div className="admin-artist-info"><h3>{artist.name}</h3><div className="mono admin-artist-email">{artist.email}</div></div><button type="button" className="btn btn-primary btn-sm" onClick={() => setPending({ ...artist, nextRole: 'sub_admin' })}>Make sub-admin</button></article>)}</div>
      {!candidates.some((artist) => `${artist.name} ${artist.email}`.toLowerCase().includes(search.trim().toLowerCase())) && <p role="status">No matching active artists. The person must have an active Artist account first.</p>}
    </div>}
    <PageLoadState loading={loading} error={error} onRetry={load} label="sub-admins…" />
    {!loading && !error && accounts.length === 0 && <div className="empty">No sub-admin accounts.</div>}
    {!loading && !error && accounts.length > 0 && <div className="admin-list">{accounts.map((account) => <article className="admin-artist-card" key={account._id}><div className="admin-artist-avatar">{(account.name || '?').slice(0, 2).toUpperCase()}</div><div className="admin-artist-info"><h2>{account.name}</h2><div className="mono admin-artist-email">{account.email}</div></div><div className="exhibit-row-actions"><button className="btn btn-danger btn-sm" type="button" onClick={() => setPending(account)}>Revoke access</button></div></article>)}</div>}
    {pending && <RoleChangeDialog artist={pending} role={pending.nextRole || 'artist'} onClose={() => setPending(null)} onSuccess={() => { toast(`${pending.name} is now ${pending.nextRole === 'sub_admin' ? 'a Sub-admin' : 'an Artist'}. Confirmation emails have been queued.`); setPending(null); setAdding(false); load(); }} />}
  </section>;
}
