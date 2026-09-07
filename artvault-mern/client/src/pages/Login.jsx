import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import AuthNav from '../components/AuthNav';

export default function Login() {
  const { login, user, resendConfirmation } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loginRole, setLoginRole] = useState('artist');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [lockSeconds, setLockSeconds] = useState(0);
  const [needsConfirmation, setNeedsConfirmation] = useState(false);
  const [resending, setResending] = useState(false);
  const lockInterval = useRef(null);

  // Kept as a safe no-op for legacy hidden markup; demo shortcuts are disabled.
  function fillDemo() {}

  useEffect(() => {
    // Do not redirect while a role-restricted sign-in is still being checked.
    // This prevents an artist account from briefly reaching the homepage after
    // selecting Admin and then being rejected.
    if (user && !submitting) navigate('/', { replace: true });
  }, [user, navigate, submitting]);

  useEffect(() => {
    if (lockSeconds <= 0) {
      clearInterval(lockInterval.current);
      return;
    }
    lockInterval.current = setInterval(() => setLockSeconds((s) => s - 1), 1000);
    return () => clearInterval(lockInterval.current);
  }, [lockSeconds > 0]); // eslint-disable-line react-hooks/exhaustive-deps

  async function onSubmit(e) {
    e.preventDefault();
    if (lockSeconds > 0) return;
    setError('');
    setNeedsConfirmation(false);
    if (!email || !password) {
      setError('Enter both your email and password.');
      return;
    }
    setSubmitting(true);
    try {
      await login(email, password, loginRole);
      navigate('/');
    } catch (err) {
      if (err.locked) {
        setLockSeconds(err.secondsLeft || 300);
      } else if (err.code === 'email_not_confirmed' || /confirm.*email|email.*confirm/i.test(err.message || '')) {
        setNeedsConfirmation(true);
        setError('Please confirm your email before signing in.');
      } else {
        if (err.message === 'This account does not have administrator access.') {
          setError('You selected Admin, but this account is not an administrator. Choose Artist or use an approved admin account.');
          setPassword('');
          return;
        }
        const message = err.message === 'Failed to fetch'
          ? 'Cannot reach Supabase. Check the Project URL in client/.env, confirm the project is active, then restart Vite.'
          : (err.message || 'Invalid credentials.');
        setError(message);
        setPassword('');
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function resendEmail() {
    if (!email.trim()) {
      setError('Enter your email address first.');
      return;
    }
    setResending(true);
    try {
      await resendConfirmation(email);
      setError('A new confirmation email has been sent. Check your inbox and spam folder.');
    } catch (err) {
      setError(err.message || 'Could not resend the confirmation email.');
    } finally {
      setResending(false);
    }
  }

  const mm = String(Math.floor(lockSeconds / 60)).padStart(1, '0');
  const ss = String(lockSeconds % 60).padStart(2, '0');

  return (
    <div className="auth-page">
      <AuthNav active="login" />
      <div className="gate">
      <div className="gate-pitch">
        <Link to="/" className="gate-brand">
          <img className="gate-brand-logo" src="/artvault-logos/artvault_logo_lightbg.png" alt="" />
          ArtVault
        </Link>
        <h1>Show What You Make,<br />Not Just <em>Where</em> You Keep It.</h1>
        <p className="sub">
          Upload your artwork, join curated exhibits, and keep every piece — and the story
          behind it — in one place, across every discipline you work in.
        </p>
      </div>

      <div className="gate-form-panel">
        <div className="gate-form-tag">ArtVault — 2026</div>
        <div className="gate-card">
          <div className="gate-eyebrow">Welcome back</div>
          <h2>Sign in to your Studio</h2>
          <p className="sub">
            Passwords are hashed before checking against your account. Three failed attempts
            locks sign-in for 5 minutes.
          </p>
          {error && (
            <div className="gate-error"><span>⚠</span><span>{error}</span></div>
          )}
          {needsConfirmation && (
            <button className="resend-confirmation" type="button" onClick={resendEmail} disabled={resending}>
              {resending ? 'Sending...' : 'Resend confirmation email'}
            </button>
          )}
          {lockSeconds > 0 && (
            <div className="gate-locked">
              <span>🔒</span>
              <span>Locked — try again in <b className="mono">{mm}:{ss}</b></span>
            </div>
          )}

          <form onSubmit={onSubmit}>
            <div className="gate-field">
                  <label htmlFor="email">Email <span className="required-mark" aria-hidden="true">*</span></label>
              <input
                  id="email" type="email" required placeholder="e.g. juan@example.com" autoComplete="email"
                value={email} onChange={(e) => setEmail(e.target.value)} disabled={lockSeconds > 0}
              />
            </div>
            <div className="gate-field">
                  <label htmlFor="password">Password <span className="required-mark" aria-hidden="true">*</span></label>
              <div className="gate-field-wrap">
                <input
                  id="password" type={showPw ? 'text' : 'password'} required placeholder="Enter your ArtVault password"
                  value={password} onChange={(e) => setPassword(e.target.value)} disabled={lockSeconds > 0}
                />
                <button type="button" className="gate-show-toggle" onClick={() => setShowPw((s) => !s)}>
                  {showPw ? 'hide' : 'show'}
                </button>
              </div>
            </div>

            <button className="gate-submit" type="submit" disabled={submitting || lockSeconds > 0}>
              {submitting ? <span className="spinner" /> : null}
              {submitting ? 'Verifying…' : 'Sign in'}
            </button>
          </form>

          <div className="login-role-picker" aria-label="Account type">
            <span className="lbl">Sign in as</span>
            <div className="login-role-buttons">
              <button type="button" className={`demo-chip${loginRole === 'artist' ? ' selected' : ''}`} onClick={() => setLoginRole('artist')}>Artist</button>
              <button type="button" className={`demo-chip${loginRole === 'admin' ? ' selected' : ''}`} onClick={() => setLoginRole('admin')}>Admin</button>
            </div>
            <div className="login-role-hint">{loginRole === 'admin' ? 'Only approved admin accounts can continue.' : 'Artist accounts can access artist features after sign-in.'}</div>
          </div>

          <div className="gate-demo">
            <div className="lbl">Demo accounts — still runs the real sign-in check</div>
            <div className="gate-demo-row">
              <button className="demo-chip" onClick={() => fillDemo('artist')}>🎨 Artist</button>
              <button className="demo-chip" onClick={() => fillDemo('admin')}>🛡️ Admin</button>
            </div>
          </div>

          <div className="gate-switch">
            New here? <Link to="/signup">Create an account</Link>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}
