import { useState } from 'react';
import { createPortal } from 'react-dom';
import api from '../api';

export default function RoleChangeDialog({ artist, role, onClose, onSuccess }) {
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState(false);
  const action = role === 'sub_admin' ? 'Promote to Sub-admin' : 'Revoke Sub-admin access';
  async function submit(event) {
    event.preventDefault(); if (busy) return;
    setBusy(true); setError(false); setMessage(sent ? 'Verifying and applying access change…' : 'Sending verification email to the Main Admin…');
    try {
      if (!sent) {
        const { data } = await api.post(`/artists/admin/${artist._id}/role/otp`, { role });
        setSent(true); setMessage(data.message);
      } else {
        const { data } = await api.put(`/artists/admin/${artist._id}/role`, { role, otp: code, confirmed: true });
        onSuccess(data);
      }
    } catch (err) { setError(true); setMessage(err.response?.data?.message || 'Could not confirm the change. Refresh the account list before retrying.'); }
    finally { setBusy(false); }
  }
  return createPortal(<div className="modal-overlay"><form className="modal-box" role="dialog" aria-modal="true" aria-labelledby="role-dialog-title" onSubmit={submit}>
    <h2 id="role-dialog-title">{action}?</h2>
    <p><strong>{artist.name}</strong> ({artist.email}) will {role === 'sub_admin' ? 'gain access to gallery, exhibit, and artist administration.' : 'return to an Artist account and lose Sub-admin permissions.'}</p>
    <p>The Main Admin must verify this specific change by email. Confirmation notices are sent to both accounts afterward.</p>
    {sent && <div className="field"><label htmlFor="role-change-otp">Eight-digit Main Admin email code</label><input id="role-change-otp" inputMode="numeric" autoComplete="one-time-code" required pattern="[0-9]{8}" maxLength={8} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))} /><p className="hint">Expires in 10 minutes. Five attempts maximum. Requesting a new email invalidates the previous code.</p></div>}
    {message && <div className={`security-feedback ${error ? 'error' : 'info'}`} role={error ? 'alert' : 'status'}>{message}</div>}
    <div className="modal-actions"><button type="button" className="btn btn-ghost" disabled={busy} onClick={onClose}>Cancel</button>
      {sent && <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => { setSent(false); setCode(''); setMessage('Confirm again to request a new email. Allow one minute between requests.'); }}>Request new code</button>}
      <button className="btn btn-primary" disabled={busy || (sent && code.length !== 8)}>{busy ? sent ? 'Verifying…' : 'Sending email…' : sent ? `Verify and ${role === 'sub_admin' ? 'promote' : 'revoke'}` : 'Confirm and send OTP'}</button></div>
  </form></div>, document.body);
}
