import { useEffect, useRef, useState } from 'react';
import { createRecoveryClient } from '../lib/supabase';
import { EMAIL_OTP_LENGTH, EMAIL_OTP_PATTERN, isValidEmailOtp, normalizeEmailOtp } from '../lib/emailOtp';

const RESEND_WAIT_SECONDS = 60;

export default function PasswordRecoveryModal({ initialEmail = '', onClose, onPasswordChanged, onContinueSignIn }) {
  const [client] = useState(createRecoveryClient);
  const [step, setStep] = useState('email');
  const [email, setEmail] = useState(initialEmail.trim().toLowerCase());
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [resendSeconds, setResendSeconds] = useState(0);
  const dialogRef = useRef(null);
  const verifiedRef = useRef(false);
  const newCredentials = useRef(null);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
      newCredentials.current = null;
      if (verifiedRef.current) client?.auth.signOut({ scope: 'local' }).catch(() => null);
    };
  }, [client]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      (dialogRef.current?.querySelector('[data-recovery-focus]') || dialogRef.current)?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [step]);

  useEffect(() => {
    if (resendSeconds <= 0) return undefined;
    const timer = window.setTimeout(() => setResendSeconds((seconds) => seconds - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [resendSeconds]);

  function close() {
    if (!busy) onClose();
  }

  function handleKeyDown(event) {
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
      return;
    }
    if (event.key !== 'Tab') return;
    const focusable = [...dialogRef.current.querySelectorAll('button:not([disabled]), input:not([disabled])')];
    if (!focusable.length) {
      event.preventDefault();
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  async function sendCode(event) {
    event?.preventDefault();
    if (busy || resendSeconds > 0) return;
    const normalizedEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setError('Enter a valid email address first.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      // The Supabase Reset Password email template must include {{ .Token }}
      // for the user to receive a code instead of only the default reset link.
      const { error: requestError } = await client.auth.resetPasswordForEmail(normalizedEmail);
      if (requestError) throw requestError;
      setEmail(normalizedEmail);
      setOtp('');
      setResendSeconds(RESEND_WAIT_SECONDS);
      setStep('otp');
    } catch (requestError) {
      setError(requestError.message || 'Could not request a code. Please try again later.');
    } finally {
      setBusy(false);
    }
  }

  async function verifyCode(event) {
    event.preventDefault();
    if (busy) return;
    if (!isValidEmailOtp(otp)) {
      setError(`Enter the ${EMAIL_OTP_LENGTH}-digit code from the password-reset email.`);
      return;
    }
    setBusy(true);
    setError('');
    try {
      const { data, error: verificationError } = await client.auth.verifyOtp({
        email,
        token: otp.trim(),
        type: 'recovery',
      });
      if (verificationError) throw verificationError;
      if (!data.session) throw new Error('The code could not start a recovery session. Please request a new one.');
      verifiedRef.current = true;
      setStep('password');
    } catch (verificationError) {
      setError(verificationError.message || 'The code is invalid or expired. Request a new code.');
    } finally {
      setBusy(false);
    }
  }

  async function savePassword(event) {
    event.preventDefault();
    if (busy) return;
    if (password.length < 8) {
      setError('Use at least 8 characters for your new password.');
      return;
    }
    if (password !== confirmPassword) {
      setError('The new passwords do not match.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const { error: updateError } = await client.auth.updateUser({ password });
      if (updateError) throw updateError;
      // The password is already saved at this point; a sign-out failure must
      // not incorrectly tell the user that the password update failed.
      try { await client.auth.signOut({ scope: 'local' }); } catch { /* isolated client is discarded on close */ }
      verifiedRef.current = false;
      newCredentials.current = { email, password };
      setPassword('');
      setConfirmPassword('');
      onPasswordChanged?.();
      setStep('success');
    } catch (updateError) {
      setError(updateError.message || 'Could not update the password. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  async function continueSignIn() {
    if (busy || !newCredentials.current || !onContinueSignIn) return;
    setBusy(true); setError('');
    try {
      await onContinueSignIn(newCredentials.current.email, newCredentials.current.password);
      newCredentials.current = null;
    } catch (err) {
      setError(`Your password was saved, but sign-in could not finish. ${err.message || 'Close this dialog and sign in with your new password.'}`);
    } finally { setBusy(false); }
  }

  return (
    <div className="modal-overlay recovery-overlay" onMouseDown={(event) => event.target === event.currentTarget && close()}>
      <div className="modal-box recovery-modal" role="dialog" aria-modal="true" aria-labelledby="recovery-title" aria-describedby="recovery-description" ref={dialogRef} tabIndex={-1} onKeyDown={handleKeyDown}>
        <div className="modal-head">
          <div>
            <div className="gate-eyebrow">Account recovery</div>
            <h2 id="recovery-title">{step === 'success' ? 'Password updated' : 'Reset your password'}</h2>
          </div>
          <button className="modal-close" type="button" aria-label="Close password recovery" onClick={close} disabled={busy}>×</button>
        </div>

        {step === 'email' && <>
          <p id="recovery-description" className="recovery-description">Enter your ArtVault email and we will send a one-time recovery code.</p>
          <form onSubmit={sendCode}>
            <div className="gate-field">
              <label htmlFor="recovery-email">Email address</label>
              <input id="recovery-email" data-recovery-focus type="email" autoComplete="email" required value={email} onChange={(event) => { setEmail(event.target.value); setError(''); }} disabled={busy} placeholder="you@example.com" />
            </div>
            {error && <p className="recovery-error" role="alert">{error}</p>}
            <button className="gate-submit" type="submit" disabled={busy || resendSeconds > 0}>{busy ? 'Sending code…' : (resendSeconds > 0 ? `Send another code in ${resendSeconds}s` : 'Send recovery code')}</button>
          </form>
        </>}

        {step === 'otp' && <>
          <p id="recovery-description" className="recovery-description">If an account exists for <strong>{email}</strong>, a code is on its way. Check your inbox and spam folder.</p>
          <form onSubmit={verifyCode}>
            <div className="gate-field">
              <label htmlFor="recovery-code">{EMAIL_OTP_LENGTH}-digit email code</label>
              <input id="recovery-code" data-recovery-focus type="text" inputMode="numeric" autoComplete="one-time-code" pattern={EMAIL_OTP_PATTERN} maxLength={EMAIL_OTP_LENGTH} required value={otp} onChange={(event) => { setOtp(normalizeEmailOtp(event.target.value)); setError(''); }} disabled={busy} placeholder="Enter your code" />
            </div>
            {error && <p className="recovery-error" role="alert">{error}</p>}
            <button className="gate-submit" type="submit" disabled={busy}>{busy ? 'Checking code…' : 'Verify code'}</button>
          </form>
          <div className="recovery-secondary-actions">
            <button type="button" onClick={sendCode} disabled={busy || resendSeconds > 0}>{resendSeconds > 0 ? `Resend in ${resendSeconds}s` : 'Resend code'}</button>
            <button type="button" onClick={() => { setStep('email'); setOtp(''); setError(''); }} disabled={busy}>Change email</button>
          </div>
          <p className="recovery-hint">No code? Older accounts not yet linked to Supabase may need help from an administrator.</p>
        </>}

        {step === 'password' && <>
          <p id="recovery-description" className="recovery-description">Your email is verified. Choose a new password for <strong>{email}</strong>.</p>
          <form onSubmit={savePassword}>
            <div className="gate-field">
              <label htmlFor="recovery-password">New password</label>
              <input id="recovery-password" data-recovery-focus type={showPassword ? 'text' : 'password'} autoComplete="new-password" minLength={8} required value={password} onChange={(event) => { setPassword(event.target.value); setError(''); }} disabled={busy} placeholder="At least 8 characters" />
            </div>
            <div className="gate-field">
              <label htmlFor="recovery-confirm">Confirm new password</label>
              <input id="recovery-confirm" type={showPassword ? 'text' : 'password'} autoComplete="new-password" minLength={8} required value={confirmPassword} onChange={(event) => { setConfirmPassword(event.target.value); setError(''); }} disabled={busy} placeholder="Enter the same password" />
            </div>
            <label className="recovery-show-password"><input type="checkbox" checked={showPassword} onChange={(event) => setShowPassword(event.target.checked)} disabled={busy} /> Show passwords</label>
            {error && <p className="recovery-error" role="alert">{error}</p>}
            <button className="gate-submit" type="submit" disabled={busy}>{busy ? 'Saving password…' : 'Save new password'}</button>
          </form>
        </>}

        {step === 'success' && <>
          <p id="recovery-description" className="recovery-description" role="status">Your password has been changed. Continue to sign in with your new password. If additional protection is enabled, verify with your authenticator or one unused backup code. A successfully used backup code is removed from your unused codes.</p>
          {error && <p className="recovery-error" role="alert">{error}</p>}
          {onContinueSignIn && <button className="gate-submit" data-recovery-focus type="button" disabled={busy} onClick={continueSignIn}>{busy ? 'Continuing…' : 'Continue to sign in'}</button>}
          <button className="btn btn-ghost" type="button" disabled={busy} onClick={close}>Back to sign in</button>
        </>}
      </div>
    </div>
  );
}
