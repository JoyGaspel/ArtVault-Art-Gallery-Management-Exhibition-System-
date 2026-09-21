import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import AuthNav from '../components/AuthNav';
import PasswordToggle from '../components/PasswordToggle';

export default function Signup() {
  const { signup, verifySignupOtp, resendConfirmation, user } = useAuth();
  const navigate = useNavigate();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [extensionName, setExtensionName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [confirmationSent, setConfirmationSent] = useState(false);
  const [otp, setOtp] = useState('');
  const [resendSubmitting, setResendSubmitting] = useState(false);
  const [resendFeedback, setResendFeedback] = useState('');

  function validPersonName(value) {
    const clean = value.trim();
    return clean.length >= 2 && clean.split(/\s+/).every((part) => /^[A-Z][A-Za-z]*$/.test(part));
  }

  function validExtension(value) {
    return !value.trim() || /^(Jr|Sr|II|III|IV|V)$/i.test(value.trim().replace(/\.$/, ''));
  }

  useEffect(() => {
    if (user) navigate('/', { replace: true });
  }, [user, navigate]);

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    const cleanFirstName = firstName.trim().replace(/\s+/g, ' ');
    const cleanLastName = lastName.trim().replace(/\s+/g, ' ');
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanFirstName || !cleanLastName || !cleanEmail || !password || !confirm) {
      setError('Fill in every field to create your account.');
      return;
    }
    if (!validPersonName(cleanFirstName)) {
      setError('First name must begin with a capital letter, contain letters only, and be at least 2 characters.');
      return;
    }
    if (!validPersonName(cleanLastName)) {
      setError('Last name must begin with a capital letter, contain letters only, and be at least 2 characters.');
      return;
    }
    if (!validExtension(extensionName)) {
      setError('Extension must be Jr, Sr, II, III, IV, or V, without special symbols.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords don\u2019t match.');
      return;
    }
    setSubmitting(true);
    try {
      const cleanExtension = extensionName.trim().replace(/\.$/, '');
      const name = `${cleanFirstName} ${cleanLastName}${cleanExtension ? ` ${cleanExtension}` : ''}`;
      const result = await signup({ name, firstName: cleanFirstName, lastName: cleanLastName, extensionName: cleanExtension, email: cleanEmail, password, role: 'artist' });
      if (result?.needsOtp || result?.needsConfirmation) {
        setConfirmationSent(true);
      } else {
        navigate('/');
      }
    } catch (err) {
      const message = err.message === 'Failed to fetch'
        ? 'Cannot reach Supabase. Check the Project URL in client/.env, confirm the project is active, then restart Vite.'
        : (err.message || 'Something went wrong. Try again.');
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  async function onVerifyOtp(event) {
    event.preventDefault();
    if (!/^\d{6,8}$/.test(otp.trim())) {
      setError('Enter the verification code from your email.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await verifySignupOtp(email, otp);
      navigate('/', { replace: true });
    } catch (err) {
      if (/expired|invalid/i.test(err.message || '')) setOtp('');
      setError(err.message || 'That verification code is invalid or expired.');
    } finally {
      setSubmitting(false);
    }
  }

  async function resendOtp() {
    setResendSubmitting(true);
    setResendFeedback('');
    setError('');
    // Supabase invalidates the previous code when a new one is issued.
    setOtp('');
    try {
      await resendConfirmation(email);
      setResendFeedback(`A new verification code was sent to ${email}. Use this newest code; previous codes are no longer valid.`);
    } catch (err) {
      setError(err.message || 'Could not send another code.');
    } finally {
      setResendSubmitting(false);
    }
  }

  return (
    <div className="auth-page signup-page">
      <AuthNav active="signup" />
      <div className="signup-content" style={{ minHeight: 'calc(100vh - 72px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: 'var(--lilac-soft)' }}>
      <div className="form-card signup-card" style={{ width: '100%' }}>
        {confirmationSent ? (
          <>
            <div className="eyebrow">Check your inbox</div>
            <h1 style={{ fontSize: 26, marginBottom: 8 }}>Enter your verification code</h1>
            <p className="sub" style={{ color: 'var(--ink-soft)', fontSize: 13.5, lineHeight: 1.6 }}>
              We sent a verification code to <strong>{email}</strong>. Enter it below to activate your ArtVault account.
            </p>
            <div className="prototype-note">If the code does not arrive, check your spam folder or request a new code.</div>
            {error && <div className="gate-error"><span>⚠</span><span>{error}</span></div>}
            <form onSubmit={onVerifyOtp}>
              <div className="field">
                <label htmlFor="signup-otp">Email verification code <span className="required-mark" aria-hidden="true">*</span></label>
                <input id="signup-otp" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6,8}" maxLength={8} value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 8))} placeholder="Enter your code" />
              </div>
              <button className="btn btn-primary" type="submit" disabled={submitting} style={{ width: '100%', justifyContent: 'center' }}>{submitting ? 'Verifying…' : 'Verify email'}</button>
            </form>
            <div className="otp-actions">
              <button className="btn btn-ghost otp-resend-btn" type="button" onClick={resendOtp} disabled={resendSubmitting || submitting}>
                {resendSubmitting ? 'Sending code…' : 'Send another code'}
              </button>
              {resendFeedback && <div className="otp-feedback" role="status">✓ {resendFeedback}</div>}
            </div>
            <div className="gate-switch"><Link to="/login">Go to sign in</Link></div>
          </>
        ) : (
        <>
        <h1 style={{ fontSize: 26, marginBottom: 6 }}>Create your account</h1>
        <p className="sub" style={{ color: 'var(--ink-soft)', fontSize: 13.5, marginBottom: 24 }}>
          Free for artists. Publish your first piece in minutes.
        </p>

        {error && (
          <div className="gate-error"><span>⚠</span><span>{error}</span></div>
        )}

        <form className="signup-form" onSubmit={onSubmit}>
          <div className="field">
            <label htmlFor="firstName">First name <span className="required-mark" aria-hidden="true">*</span></label>
            <input id="firstName" required maxLength={50} value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="e.g. Juan" autoComplete="given-name" />
            <div className="hint">At least 2 letters, starting with a capital letter. Letters only.</div>
          </div>
          <div className="field">
            <label htmlFor="lastName">Last name <span className="required-mark" aria-hidden="true">*</span></label>
            <input id="lastName" required maxLength={50} value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="e.g. Dela Cruz" autoComplete="family-name" />
            <div className="hint">Use letters only; each name must be at least 2 characters.</div>
          </div>
          <div className="field">
            <label htmlFor="extensionName">Extension name <span style={{ color: 'var(--ink-faint)', fontWeight: 400 }}>(optional)</span></label>
            <input id="extensionName" value={extensionName} onChange={(e) => setExtensionName(e.target.value)} placeholder="e.g. Jr, Sr, II" autoComplete="honorific-suffix" />
            <div className="hint">Common extensions only: Jr, Sr, II, III, IV, or V.</div>
          </div>
          <div className="field">
            <label htmlFor="email">Email <span className="required-mark" aria-hidden="true">*</span></label>
            <input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="e.g. juan@example.com" autoComplete="email" />
          </div>
          <div className="field">
            <label htmlFor="password">Password <span className="required-mark" aria-hidden="true">*</span></label>
            <div className="gate-field-wrap">
              <input id="password" type={showPassword ? 'text' : 'password'} required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 6 characters" autoComplete="new-password" />
              <PasswordToggle visible={showPassword} onToggle={() => setShowPassword((value) => !value)} />
            </div>
            <div className="hint">Use at least 6 characters. A longer mix of letters, numbers, and symbols is recommended.</div>
          </div>
          <div className="field">
            <label htmlFor="confirm">Confirm password <span className="required-mark" aria-hidden="true">*</span></label>
            <div className="gate-field-wrap">
              <input id="confirm" type={showConfirm ? 'text' : 'password'} required value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Re-enter the same password" autoComplete="new-password" />
              <PasswordToggle visible={showConfirm} onToggle={() => setShowConfirm((value) => !value)} />
            </div>
            <div className="hint">Administrator accounts are provisioned separately — this form always creates an Artist account.</div>
          </div>

          <button className="btn btn-primary" type="submit" disabled={submitting} style={{ width: '100%', justifyContent: 'center' }}>
            {submitting ? <span className="spinner" /> : null}
            {submitting ? 'Creating account…' : 'Create account'}
          </button>
        </form>

        <div className="gate-switch">
          Already have an account? <Link to="/login">Sign in</Link>
        </div>
        </>
        )}
      </div>
      </div>
    </div>
  );
}
