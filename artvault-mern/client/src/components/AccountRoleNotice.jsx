import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import useAutoRefresh from '../hooks/useAutoRefresh';
import api from '../api';

export default function AccountRoleNotice() {
  const { user, updateUser, prototypeMode } = useAuth();
  const previous = useRef(null);
  const [notice, setNotice] = useState('');
  useEffect(() => {
    if (!user) { previous.current = null; setNotice(''); return; }
    if (previous.current?.id === user.id && previous.current.role !== user.role) {
      setNotice(user.role === 'sub_admin' ? 'You are now a Sub-admin. Your administration tools are available in the navigation.' : previous.current.role === 'sub_admin' && user.role === 'artist' ? 'Your Sub-admin access was revoked. You are now using an Artist account.' : 'Your account role has been updated.');
    }
    previous.current = { id: user.id, role: user.role };
  }, [user?.id, user?.role]);
  useAutoRefresh(() => {
    if (!user || prototypeMode || import.meta.env.VITE_OFFLINE_READONLY === 'true') return;
    api.get('/auth/me').then(({ data }) => { if (data.user.role !== user.role) updateUser(data.user); }).catch(() => {});
  });
  if (!user) return null;
  return <>
    {user.role === 'sub_admin' && <div className="account-role-indicator"><strong className="account-role-badge">Sub-admin</strong><span>Signed in as {user.name}. You have Sub-admin access.</span></div>}
    {notice && <div className="security-feedback" role="status">{notice} <button type="button" className="btn btn-ghost btn-sm" onClick={() => setNotice('')}>Dismiss</button></div>}
  </>;
}
