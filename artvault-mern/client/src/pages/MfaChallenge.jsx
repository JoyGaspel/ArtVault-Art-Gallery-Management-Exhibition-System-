import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import api from '../api';
import AuthNav from '../components/AuthNav';

export default function MfaChallenge() {
  const [factors, setFactors] = useState([]);
  const [factorId, setFactorId] = useState('');
  const [code, setCode] = useState('');
  const [backupMode, setBackupMode] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [remember, setRemember] = useState(true);
  useEffect(() => {
    let active = true;
    if (!supabase) { setError('Authenticator sign-in is not configured.'); return; }
    supabase.auth.mfa.listFactors().then(({ data, error }) => {
      if (!active) return;
      if (error) { setError(error.message); return; }
      const verified = (data.totp || []).filter((item) => item.status === 'verified');
      setFactors(verified); setFactorId(verified[0]?.id || '');
      if (!verified.length) setBackupMode(true);
    }).catch(() => { if (active) setError('Could not load authenticators. Try signing in again.'); });
    return () => { active = false; };
  }, []);
  async function verify(event) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      if (backupMode) await api.post('/auth/backup-codes/redeem', { code });
      else {
        const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code });
        if (error) throw error;
      }
      const { data, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !data.session) throw sessionError || new Error('Session unavailable. Sign in again.');
      localStorage.setItem('artvault_token', data.session.access_token);
      // Never carry an old browser grant into fresh verification/renewal.
      localStorage.removeItem('artvault_mfa_device');
      if (remember) {
        const remembered = await api.post('/auth/mfa/remember-device');
        localStorage.setItem('artvault_mfa_device', remembered.data.token);
      }
      const result = await api.get('/auth/me');
      window.location.assign(['main_admin', 'sub_admin', 'admin'].includes(result.data.user.role) ? '/analytics' : '/');
    } catch (err) { setError(err.response?.data?.message || err.message || 'Verification failed. Try a fresh code.'); }
    finally { setBusy(false); }
  }
  return <div className="auth-page mfa-page"><AuthNav active="login" />
    <main className="mfa-layout">
      <aside className="mfa-intro">
        <img className="mfa-brand-mark" src="/artvault-logos/artvault_logo_lightbg.png" alt="" />
        <div className="eyebrow">ArtVault account security</div>
        <h1>A little protection<br />for your creative space.</h1>
        <p>One more step to access your account. Use your authenticator or an unused backup code to finish signing in.</p>
      </aside>
      <form className="mfa-card" onSubmit={verify}>
    <div className="eyebrow">Additional sign-in protection</div>
    <h2>Verify your sign-in</h2><p className="mfa-description" id="mfa-description">{backupMode ? 'Enter one unused backup security code from your saved list.' : 'Enter the current six-digit code from your authenticator app.'}</p>
    {factors.length > 1 && <label>Authenticator<select value={factorId} onChange={(event) => setFactorId(event.target.value)}>{factors.map((item) => <option key={item.id} value={item.id}>{item.friendly_name || 'Authenticator'}</option>)}</select></label>}
    <div className="field"><label htmlFor="mfa-code">{backupMode ? 'Backup security code' : 'Authenticator code'}</label><input id="mfa-code" aria-describedby="mfa-description" disabled={busy} placeholder={backupMode ? 'xxxxx-xxxxx-xxxxx-xxxxx' : '000000'} inputMode={backupMode ? 'text' : 'numeric'} autoComplete="one-time-code" pattern={backupMode ? '[a-fA-F0-9 -]{20,30}' : '[0-9]{6}'} maxLength={backupMode ? 30 : 6} required value={code} onChange={(event) => setCode(backupMode ? event.target.value : event.target.value.replace(/\D/g, ''))} /></div>
    {error && <p className="mfa-error" role="alert">{error}</p>}
    <label className="mfa-remember"><input type="checkbox" checked={remember} disabled={busy} onChange={(event) => setRemember(event.target.checked)} /><span>Remember this browser for 15 days<small>Use only on your own device. Idle logout still applies.</small></span></label>
    <div className="mfa-actions">
    <button className="btn btn-primary" disabled={busy || (!backupMode && !factorId)}>{busy ? 'Verifying…' : 'Verify'}</button>
    {(!backupMode || factors.length > 0) && <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => { setBackupMode(!backupMode); setCode(''); setError(''); }}>{backupMode ? 'Use authenticator instead' : 'Use a backup code'}</button>}
    </div>
    {backupMode && <p className="mfa-note">Each backup code works once. After verification, your unused count updates in Settings. Without remembering this browser, backup verification lasts 15 minutes.</p>}
    <Link className="mfa-back" to="/login">Return to sign in</Link>
  </form></main></div>;
}
