import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import api from '../api';

export default function MfaChallenge() {
  const [factors, setFactors] = useState([]);
  const [factorId, setFactorId] = useState('');
  const [code, setCode] = useState('');
  const [backupMode, setBackupMode] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
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
      const result = await api.get('/auth/me');
      window.location.assign(['main_admin', 'sub_admin', 'admin'].includes(result.data.user.role) ? '/analytics' : '/');
    } catch (err) { setError(err.response?.data?.message || err.message || 'Verification failed. Try a fresh code.'); }
    finally { setBusy(false); }
  }
  return <main className="privacy-page" style={{ margin: '60px auto', padding: 20 }}><form className="form-card" onSubmit={verify}>
    <h1>Verify your sign-in</h1><p>{backupMode ? 'Enter one unused backup security code. It works once and verifies this ArtVault session for 15 minutes.' : 'Enter the current six-digit code from your authenticator app.'}</p>
    {factors.length > 1 && <label>Authenticator<select value={factorId} onChange={(event) => setFactorId(event.target.value)}>{factors.map((item) => <option key={item.id} value={item.id}>{item.friendly_name || 'Authenticator'}</option>)}</select></label>}
    <div className="field"><label htmlFor="mfa-code">{backupMode ? 'Backup security code' : 'Authenticator code'}</label><input id="mfa-code" inputMode={backupMode ? 'text' : 'numeric'} autoComplete="one-time-code" pattern={backupMode ? '[a-fA-F0-9 -]{20,30}' : '[0-9]{6}'} maxLength={backupMode ? 30 : 6} required value={code} onChange={(event) => setCode(backupMode ? event.target.value : event.target.value.replace(/\D/g, ''))} /></div>
    {error && <p role="alert">{error}</p>}
    <button className="btn btn-primary" disabled={busy || (!backupMode && !factorId)}>{busy ? 'Verifying…' : 'Verify'}</button>
    {(!backupMode || factors.length > 0) && <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => { setBackupMode(!backupMode); setCode(''); setError(''); }}>{backupMode ? 'Use authenticator instead' : 'Use a backup code'}</button>}
    {backupMode && <p>After successful verification, this code cannot be used again. Settings shows your updated number of unused codes.</p>}
    <p><Link to="/login">Return to sign in</Link></p>
  </form></main>;
}
