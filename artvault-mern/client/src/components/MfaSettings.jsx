import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export default function MfaSettings() {
  const [factors, setFactors] = useState([]);
  const [enrollment, setEnrollment] = useState(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  async function load() {
    const { data, error } = await supabase.auth.mfa.listFactors();
    if (error) throw error;
    setFactors((data.totp || []).filter((item) => item.status === 'verified'));
  }
  useEffect(() => { if (supabase) load().catch((err) => setMessage(err.message)); }, []);
  if (!supabase) return null;
  async function action(task) {
    setBusy(true); setMessage('');
    try { await task(); } catch (err) { setMessage(err.message || 'Could not update authenticator settings.'); }
    finally { setBusy(false); }
  }
  async function enable() {
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: `ArtVault ${new Date().toISOString()}` });
    if (error) throw error;
    setEnrollment(data); setCode('');
  }
  async function verify(factorId) {
    if (!/^\d{6}$/.test(code)) throw new Error('Enter the current six-digit authenticator code.');
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code });
    if (error) throw error;
    const { data } = await supabase.auth.getSession();
    if (data.session) localStorage.setItem('artvault_token', data.session.access_token);
  }
  return <div className="account-mfa-settings" style={{ marginTop: 24, paddingTop: 20, borderTop: '1px solid var(--line)' }}>
    <div className="eyebrow">Additional sign-in protection</div><h2>Authenticator verification</h2>
    <p>Once enabled, sign-in requires your password and an authenticator code. Keep access to your authenticator; lost-factor recovery requires assistance from the deployment administrator.</p>
    {factors.length > 0 && <p role="status">{factors.length} verified authenticator{factors.length === 1 ? '' : 's'} enabled.</p>}
    {enrollment && <div className="field"><p>Scan this QR code with your authenticator app, then enter its current code.</p><img className="mfa-qr" src={enrollment.totp.qr_code} alt="Authenticator enrollment QR code" />
      <button className="btn btn-ghost" disabled={busy} onClick={() => action(async () => {
        const { error } = await supabase.auth.mfa.unenroll({ factorId: enrollment.id });
        if (error) throw error;
        setEnrollment(null); setCode('');
      })}>Cancel setup</button></div>}
    {(enrollment || factors.length > 0) && <div className="field"><label htmlFor="settings-mfa-code">Current authenticator code</label><input id="settings-mfa-code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))} /></div>}
    {enrollment ? <button className="btn btn-primary" disabled={busy} onClick={() => action(async () => {
      await verify(enrollment.id); setEnrollment(null); setCode(''); await load(); setMessage('Authenticator enabled. Future sign-ins require verification.');
    })}>Verify and enable</button> : <button className="btn btn-primary" disabled={busy} onClick={() => action(enable)}>Add authenticator</button>}
    {!enrollment && factors.map((factor) => <button key={factor.id} className="btn btn-ghost" disabled={busy} onClick={() => action(async () => {
      await verify(factor.id);
      const { error } = await supabase.auth.mfa.unenroll({ factorId: factor.id });
      if (error) throw error;
      setCode(''); await load(); setMessage('Authenticator removed.');
    })}>Remove {factor.friendly_name || 'authenticator'}</button>)}
    {message && <p role="status">{message}</p>}
  </div>;
}
