import { useEffect, useState } from 'react';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import ConfirmDialog from '../components/ConfirmDialog';

export default function ManageSubAdmins() {
  const { user } = useAuth();
  const toast = useToast();
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(null);
  function load() {
    setLoading(true);
    api.get('/artists/admin').then((response) => setAccounts((response.data.artists || []).filter((artist) => artist.role === 'sub_admin')))
      .catch((error) => toast(error.response?.data?.message || 'Could not load sub-admins.', true)).finally(() => setLoading(false));
  }
  useEffect(load, []);
  async function revoke() {
    const account = pending; setPending(null); if (!account) return;
    try { await api.put(`/artists/admin/${account._id}/role`, { role: 'artist' }); setAccounts((current) => current.filter((item) => item._id !== account._id)); toast(`${account.name} is now a regular artist.`); load(); }
    catch (error) { toast(error.response?.data?.message || 'Could not revoke sub-admin access.', true); }
  }
  if (user?.role !== 'main_admin') return <div className="empty">Only the main administrator can manage sub-admins.</div>;
  return <section>
    <div className="page-head"><div><div className="eyebrow">Administration</div><h1>Manage sub-admins</h1><div className="sub">Review and revoke elevated access for artist accounts.</div></div></div>
    <div className="stat-row"><div className="stat-box"><div className="num">{accounts.length}</div><div className="lbl">Active sub-admins</div></div></div>
    {loading && <div className="empty">Loading sub-admins...</div>}
    {!loading && accounts.length === 0 && <div className="empty">No sub-admin accounts.</div>}
    {!loading && accounts.length > 0 && <div className="admin-list">{accounts.map((account) => <article className="admin-artist-card" key={account._id}><div className="admin-artist-avatar">{(account.name || '?').slice(0, 2).toUpperCase()}</div><div className="admin-artist-info"><h2>{account.name}</h2><div className="mono admin-artist-email">{account.email}</div></div><div className="exhibit-row-actions"><button className="btn btn-danger btn-sm" type="button" onClick={() => setPending(account)}>Revoke access</button></div></article>)}</div>}
    {pending && <ConfirmDialog title="Revoke sub-admin access?" message={`${pending.name} will return to a regular artist account.`} confirmLabel="Revoke access" danger onConfirm={revoke} onCancel={() => setPending(null)} />}
  </section>;
}
