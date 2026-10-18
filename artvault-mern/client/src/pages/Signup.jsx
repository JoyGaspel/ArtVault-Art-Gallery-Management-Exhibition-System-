import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import AuthNav from '../components/AuthNav';
import PasswordToggle from '../components/PasswordToggle';
import TermsModal from '../components/TermsModal';
import { EMAIL_OTP_LENGTH, EMAIL_OTP_PATTERN, isValidEmailOtp, normalizeEmailOtp } from '../lib/emailOtp';

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
  const [touched, setTouched] = useState({});
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [termsOpen, setTermsOpen] = useState(() => new URLSearchParams(window.location.search).get('terms') === 'open');
  const termsTriggerRef = useRef(null);
  const submittingRef = useRef(false);
  const resendingRef = useRef(false);

  function closeTerms() {
    setTermsOpen(false);
    if (new URLSearchParams(window.location.search).has('terms')) {
      const url = new URL(window.location.href);
      url.searchParams.delete('terms');
      navigate(`${url.pathname}${url.search}${url.hash}`, { replace: true });
    }
    requestAnimationFrame(() => termsTriggerRef.current?.focus());
  }

  function markTouched(field) {
    setTouched((current) => ({ ...current, [field]: true }));
  }

  function requiredMessage(field, value) {
    if (!touched[field] || value.trim()) return '';
    const messages = {
      firstName: 'Required: enter your first name to continue.',
      lastName: 'Required: enter your last name to continue.',
      email: 'Required: enter a valid email so we can send your verification code.',
      password: 'Required: create a password with at least 6 characters.',
      confirm: 'Required: re-enter your password to confirm it.',
      otp: 'Required: enter the verification code sent to your email.',
    };
    return messages[field];
  }

  function nameMessage(field, value) {
    const required = requiredMessage(field, value);
    if (required || !touched[field] || !value) return required;
    if (value !== value.trim() || /\s{2,}|[^A-Za-z ]/.test(value)) return 'Use letters and single spaces only; remove spaces at the beginning or end.';
    if (!validPersonName(value)) return 'Each name needs at least 2 letters and must start with a capital letter.';
    return '';
  }

  function validPersonName(value) {
    return value.length >= 2 && value.length <= 50 && /^[A-Z][A-Za-z]+(?: [A-Z][A-Za-z]+)*$/.test(value);
  }

  function validExtension(value) {
    return !value || /^(Jr|Sr|II|III|IV|V)\.?$/i.test(value);
  }

  function extensionMessage() {
    return touched.extensionName && !validExtension(extensionName) ? 'Use Jr, Sr, II, III, IV, or V without spaces.' : '';
  }

  function emailMessage() {
    const required = requiredMessage('email', email);
    if (required || !touched.email || !email) return required;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254 ? '' : 'Enter a valid email address without spaces.';
  }

  useEffect(() => {
    if (user) navigate('/', { replace: true });
  }, [user, navigate]);

  async function onSubmit(e) {
    e.preventDefault();
    if (submittingRef.current) return;
    setError('');
    const cleanFirstName = firstName;
    const cleanLastName = lastName;
    const cleanEmail = email.toLowerCase();
    if (!cleanFirstName || !cleanLastName || !cleanEmail || !password || !confirm) {
      setTouched({ firstName: true, lastName: true, email: true, password: true, confirm: true, terms: true });
      setError('Fill in every field to create your account.');
      return;
    }
    if (!validPersonName(cleanFirstName)) {
      markTouched('firstName');
      setError('First name needs 2 or more letters, a capital first letter, and no extra spaces.');
      return;
    }
    if (!validPersonName(cleanLastName)) {
      markTouched('lastName');
      setError('Last name needs capitalized words separated by one space, with no extra spaces.');
      return;
    }
    if (!validExtension(extensionName)) {
      markTouched('extensionName');
      setError('Extension must be Jr, Sr, II, III, IV, or V, without special symbols.');
      return;
    }
    if (cleanEmail.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      markTouched('email');
      setError('Enter a valid email address of 254 characters or fewer.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password.length > 128) {
      setError('Password must be 128 characters or fewer.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords don\u2019t match.');
      return;
    }
    if (!acceptedTerms) {
      setTouched((current) => ({ ...current, terms: true }));
      setError('Review and accept the Terms and Conditions to create your account.');
      return;
    }
    submittingRef.current = true;
    setSubmitting(true);
    try {
      const cleanExtension = extensionName.trim().replace(/\.$/, '');
      const name = `${cleanFirstName} ${cleanLastName}${cleanExtension ? ` ${cleanExtension}` : ''}`;
      const result = await signup({ name, firstName: cleanFirstName, lastName: cleanLastName, extensionName: cleanExtension, email: cleanEmail, password, role: 'artist', acceptedTerms: true });
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
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  async function onVerifyOtp(event) {
    event.preventDefault();
    if (submittingRef.current) return;
    if (!isValidEmailOtp(otp)) {
      markTouched('otp');
      setError(`Enter the ${EMAIL_OTP_LENGTH}-digit verification code from your email.`);
      return;
    }
    submittingRef.current = true;
    setSubmitting(true);
    setError('');
    try {
      await verifySignupOtp(email, otp);
      navigate('/', { replace: true });
    } catch (err) {
      if (/expired|invalid/i.test(err.message || '')) setOtp('');
      setError(err.message || 'That verification code is invalid or expired.');
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  async function resendOtp() {
    if (resendingRef.current || submittingRef.current) return;
    resendingRef.current = true;
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
      resendingRef.current = false;
      setResendSubmitting(false);
    }
  }

  return (
    <div className="auth-page signup-page">
      <AuthNav active="signup" />
      <div className="signup-layout">
      <div className="signup-content" style={{ minHeight: 'calc(100vh - 72px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: 'var(--lilac-soft)' }}>
      <div className="form-card signup-card" style={{ width: '100%' }}>
        {confirmationSent ? (
          <>
            <div className="eyebrow">Check your inbox</div>
            <h1 style={{ fontSize: 26, marginBottom: 8 }}>Enter your verification code</h1>
            <p className="sub" style={{ color: 'var(--ink-soft)', fontSize: 13.5, lineHeight: 1.6 }}>
              We sent an {EMAIL_OTP_LENGTH}-digit verification code to <strong>{email}</strong>. Enter it below to activate your ArtVault account.
            </p>
            <div className="prototype-note">If the code does not arrive, check your spam folder or request a new code.</div>
            {error && <div className="gate-error"><span>⚠</span><span>{error}</span></div>}
            <form onSubmit={onVerifyOtp}>
              <div className="field">
                <label htmlFor="signup-otp">{EMAIL_OTP_LENGTH}-digit email verification code <span className="required-mark" aria-hidden="true">*</span></label>
                <input id="signup-otp" inputMode="numeric" autoComplete="one-time-code" pattern={EMAIL_OTP_PATTERN} maxLength={EMAIL_OTP_LENGTH} value={otp} onChange={(event) => setOtp(normalizeEmailOtp(event.target.value))} onBlur={() => markTouched('otp')} aria-invalid={Boolean(requiredMessage('otp', otp))} placeholder="Enter your code" />
                {requiredMessage('otp', otp) && <div className="required-feedback" role="status">{requiredMessage('otp', otp)}</div>}
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
            <input id="firstName" required maxLength={50} value={firstName} onChange={(e) => setFirstName(e.target.value)} onBlur={() => markTouched('firstName')} aria-invalid={Boolean(nameMessage('firstName', firstName))} placeholder="e.g. Juan" autoComplete="given-name" />
            {nameMessage('firstName', firstName) && <div className="required-feedback" role="status">{nameMessage('firstName', firstName)}</div>}
            <div className="hint">At least 2 letters, starting with a capital letter. Letters only.</div>
          </div>
          <div className="field">
            <label htmlFor="lastName">Last name <span className="required-mark" aria-hidden="true">*</span></label>
            <input id="lastName" required maxLength={50} value={lastName} onChange={(e) => setLastName(e.target.value)} onBlur={() => markTouched('lastName')} aria-invalid={Boolean(nameMessage('lastName', lastName))} placeholder="e.g. Dela Cruz" autoComplete="family-name" />
            {nameMessage('lastName', lastName) && <div className="required-feedback" role="status">{nameMessage('lastName', lastName)}</div>}
            <div className="hint">Use letters only; each name must be at least 2 characters.</div>
          </div>
          <div className="field">
            <label htmlFor="extensionName">Extension name <span style={{ color: 'var(--ink-faint)', fontWeight: 400 }}>(optional)</span></label>
            <input id="extensionName" maxLength={10} value={extensionName} onChange={(e) => setExtensionName(e.target.value)} onBlur={() => markTouched('extensionName')} aria-invalid={Boolean(extensionMessage())} placeholder="e.g. Jr, Sr, II" autoComplete="honorific-suffix" />
            {extensionMessage() && <div className="required-feedback" role="status">{extensionMessage()}</div>}
            <div className="hint">Common extensions only: Jr, Sr, II, III, IV, or V.</div>
          </div>
          <div className="field">
            <label htmlFor="email">Email <span className="required-mark" aria-hidden="true">*</span></label>
            <input id="email" type="email" required maxLength={254} value={email} onChange={(e) => setEmail(e.target.value)} onBlur={() => markTouched('email')} aria-invalid={Boolean(emailMessage())} placeholder="e.g. juan@example.com" autoComplete="email" />
            {emailMessage() && <div className="required-feedback" role="status">{emailMessage()}</div>}
          </div>
          <div className="field">
            <label htmlFor="password">Password <span className="required-mark" aria-hidden="true">*</span></label>
            <div className="gate-field-wrap">
              <input id="password" type={showPassword ? 'text' : 'password'} required maxLength={128} value={password} onChange={(e) => setPassword(e.target.value)} onBlur={() => markTouched('password')} aria-invalid={Boolean(requiredMessage('password', password))} placeholder="At least 6 characters" autoComplete="new-password" />
              <PasswordToggle visible={showPassword} onToggle={() => setShowPassword((value) => !value)} />
            </div>
            {requiredMessage('password', password) && <div className="required-feedback" role="status">{requiredMessage('password', password)}</div>}
            <div className="hint">Use at least 6 characters. A longer mix of letters, numbers, and symbols is recommended.</div>
          </div>
          <div className="field">
            <label htmlFor="confirm">Confirm password <span className="required-mark" aria-hidden="true">*</span></label>
            <div className="gate-field-wrap">
              <input id="confirm" type={showConfirm ? 'text' : 'password'} required value={confirm} onChange={(e) => setConfirm(e.target.value)} onBlur={() => markTouched('confirm')} aria-invalid={Boolean(requiredMessage('confirm', confirm))} placeholder="Re-enter the same password" autoComplete="new-password" />
              <PasswordToggle visible={showConfirm} onToggle={() => setShowConfirm((value) => !value)} />
            </div>
            {requiredMessage('confirm', confirm) && <div className="required-feedback" role="status">{requiredMessage('confirm', confirm)}</div>}
            <div className="hint">Administrator accounts are provisioned separately — this form always creates an Artist account.</div>
          </div>

          <div className="field signup-terms-field">
            <div className="signup-terms-choice">
              <input id="acceptedTerms" type="checkbox" checked={acceptedTerms} onChange={(e) => setAcceptedTerms(e.target.checked)} onBlur={() => markTouched('terms')} aria-invalid={touched.terms && !acceptedTerms} />
              <div><label htmlFor="acceptedTerms">I have read and agree to the</label>{' '}<button ref={termsTriggerRef} className="signup-terms-open" type="button" onClick={() => setTermsOpen(true)}>ArtVault Terms and Conditions</button>.</div>
            </div>
            {touched.terms && !acceptedTerms && <div className="required-feedback" role="status">Required: accept the terms to continue.</div>}
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
      <aside className="signup-showcase" aria-label="What you can do with ArtVault">
        <div className="signup-showcase-content">
          <span className="signup-showcase-kicker">Your creative space</span>
          <h2>Every piece deserves a place.</h2>
          <p>Make an artist account to share your work, keep pieces private until you are ready, and take part in curated exhibits.</p>
          <div className="signup-showcase-features">
            <div><span>01</span><div><strong>Build your portfolio</strong><p>Publish artwork in the gallery and on your artist profile.</p></div></div>
            <div><span>02</span><div><strong>Keep a private Vault</strong><p>Choose which pieces stay hidden until you make them public.</p></div></div>
            <div><span>03</span><div><strong>Join exhibits</strong><p>Submit your work and follow its review status.</p></div></div>
          </div>
        </div>
      </aside>
      </div>
      {termsOpen && <TermsModal onClose={closeTerms} />}
    </div>
  );
}
