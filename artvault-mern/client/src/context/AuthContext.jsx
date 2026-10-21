import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import api from '../api';
import {
  clearPrototypeSession,
  prototypeLogin,
  prototypeSignup,
  refreshPrototypeSession,
  restorePrototypeSession,
} from '../prototypeAuth';
import { supabase, supabaseEnabled } from '../lib/supabase';
import { EMAIL_OTP_LENGTH, isValidEmailOtp } from '../lib/emailOtp';

const AuthContext = createContext(null);

// PROTOTYPE MODE: set this to false when the MongoDB-backed API session is ready.
// The production replacement should use the server's HttpOnly/Secure cookie session.
const OFFLINE_READONLY = import.meta.env.VITE_OFFLINE_READONLY === 'true';
const PROTOTYPE_AUTH = import.meta.env.DEV && !supabaseEnabled && !OFFLINE_READONLY;

function mapSupabaseUser(authUser) {
  if (!authUser) return null;
  const isMainAdmin = authUser.email?.trim().toLowerCase() === (import.meta.env.VITE_MAIN_ADMIN_EMAIL || 'gama.orgas.up@phinmaed.com').trim().toLowerCase();
  return {
    id: authUser.id,
    name: authUser.user_metadata?.name || authUser.email?.split('@')[0] || 'Artist',
    firstName: authUser.user_metadata?.firstName || '',
    lastName: authUser.user_metadata?.lastName || '',
    extensionName: authUser.user_metadata?.extensionName || '',
    email: authUser.email,
    role: isMainAdmin ? 'main_admin' : (authUser.user_metadata?.role === 'admin' ? 'admin' : 'artist'),
    specializations: authUser.user_metadata?.specializations || [],
    bio: authUser.user_metadata?.bio || '',
  };
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sessionError, setSessionError] = useState('');
  const [restoreAttempt, setRestoreAttempt] = useState(0);
  const sessionGeneration = useRef(0);
  const idleTimer = useRef(null);

  const logout = useCallback(() => {
    sessionGeneration.current++;
    localStorage.setItem('artvault_explicit_logout', 'true');
    setSessionError(''); setLoading(false);
    window.clearTimeout(idleTimer.current);
    const token = localStorage.getItem('artvault_token');
    if (token && !PROTOTYPE_AUTH) {
      // Persist revocation while Supabase still accepts the access token.
      api.post('/auth/logout', {}, { headers: { Authorization: `Bearer ${token}` } }).catch(() => {
        console.warn('Server sign-out could not be confirmed; the token expires according to its configured lifetime.');
      }).then(() => supabase?.auth.signOut()).catch(() => console.warn('Provider sign-out could not be confirmed.'));
    } else if (!PROTOTYPE_AUTH && supabase) supabase.auth.signOut();
    clearPrototypeSession();
    localStorage.removeItem('artvault_token');
    setUser(null);
  }, []);

  useEffect(() => {
    if (OFFLINE_READONLY || (!supabase && !PROTOTYPE_AUTH)) {
      localStorage.removeItem('artvault_token');
      setUser(null);
      setLoading(false);
      return undefined;
    }
    if (PROTOTYPE_AUTH) {
      setUser(restorePrototypeSession());
      setLoading(false);
      return undefined;
    }

    let mounted = true;
    let timer;
    async function restore(session) {
      const generation = ++sessionGeneration.current;
      const current = () => mounted && generation === sessionGeneration.current;
      if (localStorage.getItem('artvault_explicit_logout') === 'true') {
        setUser(null); setLoading(false); return;
      }
      if (!session?.access_token) {
        const legacy = localStorage.getItem('artvault_token');
        if (!legacy) { setUser(null); setSessionError(''); setLoading(false); return; }
      } else localStorage.setItem('artvault_token', session.access_token);
      try {
        const response = await api.get('/auth/me');
        if (!current()) return;
        setUser(response.data.user); setSessionError(''); setLoading(false);
      } catch (error) {
        if (!current()) return;
        if (error.response?.status === 401 || error.response?.status === 423) {
          setUser(null); localStorage.removeItem('artvault_token'); setSessionError('');
        } else if (error.response?.data?.code === 'MFA_REQUIRED') {
          setUser(null); setSessionError('');
        } else {
          setSessionError('Your session is saved, but we could not verify it with the server. Check your connection and retry.');
        }
        setLoading(false);
      }
    }
    function schedule(session) {
      clearTimeout(timer);
      // Do provider work outside the auth event callback to avoid lock races.
      timer = setTimeout(() => restore(session), 0);
    }
    supabase.auth.getSession().then(({ data, error }) => {
      if (!mounted) return;
      if (error) { setSessionError('Could not restore your saved session. Check your connection and retry.'); setLoading(false); return; }
      schedule(data.session);
    }).catch(() => { if (mounted) { setSessionError('Could not restore your saved session. Please retry.'); setLoading(false); } });
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        sessionGeneration.current++; clearTimeout(timer);
        localStorage.removeItem('artvault_token'); setUser(null); setSessionError(''); setLoading(false);
      } else schedule(session);
    });
    const retry = () => setRestoreAttempt((value) => value + 1);
    const syncLogout = (event) => {
      if (event.key === 'artvault_explicit_logout') retry();
    };
    window.addEventListener('online', retry);
    window.addEventListener('pageshow', retry);
    window.addEventListener('storage', syncLogout);
    return () => {
      mounted = false;
      clearTimeout(timer); sessionGeneration.current++;
      window.removeEventListener('online', retry);
      window.removeEventListener('pageshow', retry);
      window.removeEventListener('storage', syncLogout);
      listener.subscription.unsubscribe();
    };

  }, [restoreAttempt]);

  useEffect(() => {
    if (!user) return undefined;
    const resetIdleTimer = () => {
      if (PROTOTYPE_AUTH) refreshPrototypeSession();
      window.clearTimeout(idleTimer.current);
      idleTimer.current = window.setTimeout(logout, 30 * 60 * 1000);
    };
    const events = ['pointerdown', 'keydown', 'scroll', 'touchstart', 'mousemove'];
    events.forEach((event) => window.addEventListener(event, resetIdleTimer, { passive: true }));
    resetIdleTimer();
    return () => {
      events.forEach((event) => window.removeEventListener(event, resetIdleTimer));
      window.clearTimeout(idleTimer.current);
    };
  }, [Boolean(user), logout]);

  const login = useCallback(async (email, password, requestedRole = '') => {
    localStorage.removeItem('artvault_explicit_logout');
    setSessionError('');
    if (!supabase && !PROTOTYPE_AUTH) throw { message: 'Authentication is not configured. Contact the deployment administrator.' };
    if (OFFLINE_READONLY) throw { message: 'This offline copy is read-only. Sign in when you are back online.' };
    if (PROTOTYPE_AUTH) {
      const prototypeUser = await prototypeLogin(email, password);
      if (requestedRole === 'admin' && !['admin', 'sub_admin', 'main_admin'].includes(prototypeUser.role)) {
        throw { message: 'This account does not have administrator access.' };
      }
      setUser(prototypeUser);
      return prototypeUser;
    }
    const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
    if (error) {
      // Keep older MongoDB-only accounts usable during the Supabase migration.
      // Accounts already linked to Supabase cannot bypass Supabase because the
      // server stores an unusable random legacy password for those users.
      try {
        const legacy = await api.post('/auth/login', { email, password });
        if (legacy.data?.token && legacy.data?.user) {
          localStorage.setItem('artvault_token', legacy.data.token);
          if (requestedRole === 'admin' && !['admin', 'sub_admin', 'main_admin'].includes(legacy.data.user.role)) {
            localStorage.removeItem('artvault_token');
            throw { message: 'This account does not have administrator access.' };
          }
          setUser(legacy.data.user);
          return legacy.data.user;
        }
      } catch (legacyError) {
        if (legacyError?.message === 'This account does not have administrator access.') throw legacyError;
        const legacyData = legacyError?.response?.data;
        if (legacyData?.locked || Number.isInteger(legacyData?.attemptsRemaining)) {
          throw {
            message: legacyData.message,
            locked: Boolean(legacyData.locked),
            secondsLeft: legacyData.secondsLeft,
            attemptsRemaining: legacyData.attemptsRemaining,
            status: legacyError.response?.status,
          };
        }
      }
      const message = /not confirmed|email not confirmed/i.test(error.message || '')
        ? 'Please confirm your email before signing in.'
        : error.message;
      throw { message, code: error.code, status: error.status };
    }
    if (data.session?.access_token) localStorage.setItem('artvault_token', data.session.access_token);
    try {
      const response = await api.get('/auth/me');
      // Reset the MongoDB lockout counter after Supabase confirms the login.
      // Keep sign-in compatible with older API deployments that lack this
      // endpoint yet; the successful Supabase session remains valid.
      // This bookkeeping request does not determine whether login succeeded,
      // so do it in the background instead of making the user wait for a
      // second round trip after /auth/me.
      api.post('/auth/login-success').catch(() => null);
      if (requestedRole === 'admin' && !['admin', 'sub_admin', 'main_admin'].includes(response.data.user.role)) {
        setUser(null);
        await supabase.auth.signOut();
        localStorage.removeItem('artvault_token');
        throw { message: 'This account does not have administrator access.' };
      }
      setUser(response.data.user);
      return response.data.user;
    } catch (verificationError) {
      if (verificationError.response?.data?.code === 'MFA_REQUIRED') throw { code: 'MFA_REQUIRED', message: 'Enter your authenticator code.' };
      setUser(null);
      await supabase.auth.signOut();
      localStorage.removeItem('artvault_token');
      // Preserve deliberate role/access errors (for example, an artist
      // choosing the Admin sign-in option) instead of replacing them with a
      // misleading server-verification message.
      if (verificationError?.message === 'This account does not have administrator access.') {
        throw verificationError;
      }
      const serverMessage = verificationError?.response?.data?.message;
      if (serverMessage) throw { message: serverMessage, status: verificationError.response.status };
      throw { message: 'Could not verify your account with the application server. Please try again.' };
    }
  }, []);

  const signup = useCallback(async (payload) => {
    localStorage.removeItem('artvault_explicit_logout');
    if (!supabase && !PROTOTYPE_AUTH) throw { message: 'Authentication is not configured. Contact the deployment administrator.' };
    if (OFFLINE_READONLY) throw { message: 'Sign-up needs an internet connection. This offline copy is read-only.' };
    if (payload.acceptedTerms !== true) throw { message: 'Accept the Terms and Conditions before creating an account.' };
    if (PROTOTYPE_AUTH) {
      const prototypeUser = await prototypeSignup(payload);
      setUser(prototypeUser);
      return prototypeUser;
    }
    const { data, error } = await supabase.auth.signUp({
      email: payload.email,
      password: payload.password,
      options: {
        data: {
          name: payload.name,
          firstName: payload.firstName,
          lastName: payload.lastName,
          extensionName: payload.extensionName || '',
          role: 'artist',
          specializations: payload.specializations || [],
          bio: payload.bio || '',
          termsVersion: '2026-10-21',
          termsAcceptedAt: new Date().toISOString(),
        },
      },
    });
    if (error) {
      const message = /already registered|already been registered|already exists/i.test(error.message || '')
        ? 'An account with this email already exists. Please sign in instead.'
        : error.message;
      throw { message };
    }
    const sessionUser = mapSupabaseUser(data.user);
    if (data.session?.access_token) {
      localStorage.setItem('artvault_token', data.session.access_token);
      try {
        const response = await api.get('/auth/me');
        setUser(response.data.user);
        return { user: response.data.user, needsConfirmation: false, needsOtp: false };
      } catch {
        await supabase.auth.signOut();
        localStorage.removeItem('artvault_token');
        throw { message: 'Your account was created, but ArtVault could not confirm the sign-in. Please try signing in.' };
      }
    }
    return { user: sessionUser, needsConfirmation: true, needsOtp: true };
  }, []);

  const verifySignupOtp = useCallback(async (email, token) => {
    if (PROTOTYPE_AUTH) throw { message: 'OTP verification requires Supabase authentication.' };
    if (!isValidEmailOtp(token)) throw { message: `Enter the ${EMAIL_OTP_LENGTH}-digit verification code from your email.` };
    const { data, error } = await supabase.auth.verifyOtp({
      email: email.trim().toLowerCase(),
      token: token.trim(),
      type: 'signup',
    });
    if (error) throw { message: error.message };
    if (data.session?.access_token) localStorage.setItem('artvault_token', data.session.access_token);
    try {
      const response = await api.get('/auth/me');
      setUser(response.data.user);
      return response.data.user;
    } catch {
      await supabase.auth.signOut();
      localStorage.removeItem('artvault_token');
      throw { message: 'The email was verified, but the application server could not confirm the account.' };
    }
  }, []);

  const resendConfirmation = useCallback(async (email) => {
    if (PROTOTYPE_AUTH) return { simulated: true };
    const { error } = await supabase.auth.resend({ type: 'signup', email: email.trim().toLowerCase() });
    if (error) throw { message: error.message, code: error.code, status: error.status };
    return { sent: true };
  }, []);

  const updateUser = useCallback((partial) => {
    setUser((previous) => (previous ? { ...previous, ...partial } : previous));
  }, []);

  const requestPasswordOtp = useCallback(async (currentPassword) => {
    if (PROTOTYPE_AUTH) throw { message: 'Password changes require Supabase authentication.' };
    const verification = await supabase.auth.signInWithPassword({ email: user?.email, password: currentPassword });
    if (verification.error) throw { message: 'Current password is incorrect.' };
    const { error } = await supabase.auth.signInWithOtp({
      email: user?.email,
      options: { shouldCreateUser: false },
    });
    if (error) throw { message: error.message };
  }, [user]);

  const updatePassword = useCallback(async (password, otp = '') => {
    if (PROTOTYPE_AUTH) throw { message: 'Password changes require Supabase authentication.' };
    if (!isValidEmailOtp(otp)) throw { message: `Enter the ${EMAIL_OTP_LENGTH}-digit verification code sent to your email.` };
    const verification = await supabase.auth.verifyOtp({ email: user?.email, token: otp.trim(), type: 'email' });
    if (verification.error) throw { message: verification.error.message };
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw { message: error.message };
  }, [user]);

  return (
    <AuthContext.Provider value={{ user, loading, sessionError, retrySession: () => { setLoading(true); setRestoreAttempt((value) => value + 1); }, login, signup, verifySignupOtp, resendConfirmation, logout, updateUser, requestPasswordOtp, updatePassword, prototypeMode: PROTOTYPE_AUTH }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}
