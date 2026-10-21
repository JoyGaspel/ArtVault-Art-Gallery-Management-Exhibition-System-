import { useEffect, useState } from 'react';
import api from '../api';
import { supabase } from '../lib/supabase';
import { useToast } from './Toast';

export default function BackupCodesSettings({ email }) {
  const showToast = useToast();
  const [status, setStatus] = useState(null);
  const [purpose, setPurpose] = useState('');
  const [otp, setOtp] = useState('');
  const [codes, setCodes] = useState([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('info');
  const [operation, setOperation] = useState('');
  const [sendingPurpose, setSendingPurpose] = useState('');
  const [resendAt, setResendAt] = useState(0);
  const [expiresAt, setExpiresAt] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [destination, setDestination] = useState(email || 'your registered email');
  const [statusError, setStatusError] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const refresh = () => { if (!busy && !document.hidden) setRetry((value) => value + 1); };
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    const timer = setInterval(refresh, 30000);
    return () => { window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', refresh); clearInterval(timer); };
  }, [busy]);
  const resendSeconds = Math.max(0, Math.ceil((resendAt - now) / 1000));
  const expiresSeconds = Math.max(0, Math.ceil((expiresAt - now) / 1000));
  useEffect(() => {
    if (!resendAt && !expiresAt) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [resendAt, expiresAt]);
  useEffect(() => {
    if (!supabase) return;
    let active = true;
    setStatusError('');
    api.get('/auth/backup-codes').then(({ data }) => { if (active) setStatus(data); })
      .catch((err) => { if (active) setStatusError(err.response?.status === 404
        ? 'Backup codes are unavailable on this backend deployment. The deployment administrator must deploy the updated server. Codes created on localhost work here only when both servers use the same database, Supabase project, and backup-code signing secret.'
        : err.response?.data?.message || 'Could not load backup-code status. Please retry.'); });
    return () => { active = false; };
  }, [retry]);
  if (!supabase) return null;
  async function send(nextPurpose) {
    if (busy || resendSeconds > 0) return;
    setBusy(true); setOperation('sending'); setSendingPurpose(nextPurpose); setMessageType('info'); setMessage(`Sending a verification email to ${email || 'your registered email'}…`);
    try {
      const { data } = await api.post('/auth/backup-codes/otp', { purpose: nextPurpose });
      const sentAt = Date.now();
      setNow(sentAt); setResendAt(sentAt + (data.resendAfterSeconds ?? 60) * 1000);
      setExpiresAt(data.expiresAt ? new Date(data.expiresAt).getTime() : sentAt + 10 * 60000);
      setDestination(data.email || email || 'your registered email');
      setPurpose(nextPurpose); setOtp(''); setMessageType('success');
      setMessage(`Verification email sent to ${data.email || email || 'your registered email'}. Enter the eight-digit code below. Check your inbox and spam folder; delivery may take a few minutes.`);
      showToast('Verification email sent. Check your inbox and spam folder.');
    } catch (err) {
      const message = err.response?.data?.message || 'Could not confirm that the verification email was sent. Check your connection and inbox, then retry. Backup codes were not changed.';
      setMessageType('error'); setMessage(message); showToast(message, true);
      if (err.response?.status === 429) { setNow(Date.now()); setResendAt(Date.now() + 60000); }
    }
    finally { setBusy(false); setOperation(''); setSendingPurpose(''); }
  }
  async function confirm() {
    if (busy) return;
    if (!/^\d{8}$/.test(otp)) { setMessageType('error'); setMessage('Enter the eight-digit email verification code.'); return; }
    setBusy(true); setOperation('verifying'); setMessageType('info'); setMessage('Verifying your email code…');
    try {
      const { data } = await api.post('/auth/backup-codes/change', { purpose, otp });
      setStatus({ enabled: data.enabled, remaining: data.remaining });
      setCodes(data.codes || []); setOtp(''); setPurpose('');
      setExpiresAt(0); setMessageType('success');
      setMessage(data.enabled ? 'New backup codes created. Previous codes no longer work. Save these now; they cannot be shown again.' : 'Backup codes disabled. Unused codes no longer work.');
      showToast(data.enabled ? 'Backup codes generated. Save your new codes now.' : 'Backup codes disabled.');
    } catch (err) { const message = err.response?.data?.message || 'Could not confirm the change. Please check your connection and reload the settings before retrying.'; setMessageType('error'); setMessage(message); showToast(message, true); }
    finally { setBusy(false); setOperation(''); }
  }
  function download() {
    const text = `ArtVault backup security codes\nEach code works once after signing in with your password. Keep private and store separately from this device.\n\n${codes.join('\n')}\n`;
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = 'artvault-backup-codes.txt'; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return <div className="account-backup-settings" aria-busy={busy} style={{ marginTop: 24, paddingTop: 20, borderTop: '1px solid var(--line)' }}>
    <h2>Backup security codes</h2>
    <p>Choose backup codes, an authenticator, or both. Either method can verify sign-in; an authenticator is not required to enable backup codes. Each backup code works once and verifies that ArtVault session for 15 minutes. Email OTP verification is required to generate, replace, or disable codes.</p>
    {status && <p role="status">{status.enabled ? `${status.remaining} unused backup codes remaining.` : 'Backup codes are disabled.'}</p>}
    {!status && !statusError && <p role="status">Loading backup-code settings…</p>}
    {statusError && <div className="security-feedback error" role="alert">{statusError} <button type="button" className="btn btn-ghost" onClick={() => setRetry((value) => value + 1)}>Retry loading</button></div>}
    {message && <div className={`security-feedback ${messageType}`} role={messageType === 'error' ? 'alert' : 'status'} aria-live={messageType === 'error' ? 'assertive' : 'polite'}>{message}</div>}
    <div className="security-action-row">
      <button type="button" className="btn btn-ghost" disabled={busy || !status || resendSeconds > 0} onClick={() => send('generate')}>{operation === 'sending' && sendingPurpose === 'generate' ? 'Sending email…' : status?.enabled ? 'Replace backup codes' : 'Enable backup codes'}</button>
      {status?.enabled && <button type="button" className="btn btn-ghost" disabled={busy || resendSeconds > 0} onClick={() => send('disable')}>{operation === 'sending' && sendingPurpose === 'disable' ? 'Sending email…' : 'Disable backup codes'}</button>}
    </div>
    {purpose && <div className="field" style={{ marginTop: 16 }}>
      <label htmlFor="backup-email-otp">Email verification code to {purpose === 'disable' ? 'disable backup codes' : 'generate or replace backup codes'}</label>
      <input id="backup-email-otp" inputMode="numeric" autoComplete="one-time-code" maxLength={8} value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, ''))} />
      <p className="hint">Email destination: {destination}. {expiresSeconds > 0 ? `Code expires in ${Math.floor(expiresSeconds / 60)}:${String(expiresSeconds % 60).padStart(2, '0')}.` : 'This code has expired. Request another email.'} Never share the verification code.</p>
      <div className="security-action-row"><button type="button" className="btn btn-primary" disabled={busy || otp.length !== 8 || expiresSeconds === 0} onClick={confirm}>{operation === 'verifying' ? 'Verifying…' : `Verify and ${purpose === 'disable' ? 'disable' : 'generate'}`}</button>
        <button type="button" className="btn btn-ghost" disabled={busy || resendSeconds > 0} onClick={() => send(purpose)}>{resendSeconds > 0 ? `Resend email in ${resendSeconds}s` : 'Resend verification email'}</button>
        <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => { setPurpose(''); setOtp(''); setExpiresAt(0); setMessageType('info'); setMessage('Verification canceled. Your backup codes were not changed.'); }}>Cancel</button></div>
    </div>}
    {codes.length > 0 && <div className="field" style={{ marginTop: 16 }}>
      <p><strong>Save these private codes now.</strong> They are shown only once. Anyone with your password and a code can sign in.</p>
      <ul style={{ fontFamily: 'monospace', overflowWrap: 'anywhere' }}>{codes.map((code) => <li key={code}>{code}</li>)}</ul>
      <div className="security-action-row"><button type="button" className="btn btn-ghost" onClick={download}>Download codes</button><button type="button" className="btn btn-ghost" onClick={() => setCodes([])}>I saved them — hide codes</button></div>
    </div>}
    {!purpose && resendSeconds > 0 && <p className="hint" role="status">Another verification email can be requested in {resendSeconds}s.</p>}
  </div>;
}
