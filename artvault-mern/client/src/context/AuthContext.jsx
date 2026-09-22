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

const AuthContext = createContext(null);

// PROTOTYPE MODE: set this to false when the MongoDB-backed API session is ready.
// The production replacement should use the server's HttpOnly/Secure cookie session.
const PROTOTYPE_AUTH = !supabaseEnabled;

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
  const idleTimer = useRef(null);

  const logout = useCallback(() => {
    if (!PROTOTYPE_AUTH) supabase.auth.signOut();
    clearPrototypeSession();
    localStorage.removeItem('artvault_token');
    setUser(null);
  }, []);

  const resetIdleTimer = useCallback(() => {
    if (!PROTOTYPE_AUTH || !user) return;
    refreshPrototypeSession();
    window.clearTimeout(idleTimer.current);
    idleTimer.current = window.setTimeout(logout, 15 * 60 * 1000);
  }, [logout, user]);

  useEffect(() => {
    if (PROTOTYPE_AUTH) {
      setUser(restorePrototypeSession());
      setLoading(false);
      return undefined;
    }

    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      if (data.session?.access_token) localStorage.setItem('artvault_token', data.session.access_token);
      if (data.session?.access_token) {
        api.get('/auth/me').then((response) => setUser(response.data.user)).catch(() => setUser(null)).finally(() => setLoading(false));
      } else {
        setUser(null);
        setLoading(false);
      }
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.access_token) {
        localStorage.setItem('artvault_token', session.access_token);
        api.get('/auth/me').then((response) => setUser(response.data.user)).catch(() => setUser(null));
      } else {
        localStorage.removeItem('artvault_token');
        setUser(null);
      }
    });
    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };

  }, []);

  useEffect(() => {
    if (!PROTOTYPE_AUTH || !user) return undefined;
    const events = ['pointerdown', 'keydown', 'scroll', 'touchstart'];
    events.forEach((event) => window.addEventListener(event, resetIdleTimer));
    resetIdleTimer();
    return () => {
      events.forEach((event) => window.removeEventListener(event, resetIdleTimer));
      window.clearTimeout(idleTimer.current);
    };
  }, [resetIdleTimer, user]);

  const login = useCallback(async (email, password, requestedRole = '') => {
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
      await api.post('/auth/login-success').catch(() => null);
      if (requestedRole === 'admin' && !['admin', 'sub_admin', 'main_admin'].includes(response.data.user.role)) {
        setUser(null);
        await supabase.auth.signOut();
        localStorage.removeItem('artvault_token');
        throw { message: 'This account does not have administrator access.' };
      }
      setUser(response.data.user);
      return response.data.user;
    } catch (verificationError) {
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
    if (data.session) setUser(sessionUser);
    return { user: sessionUser, needsConfirmation: !data.session, needsOtp: !data.session };
  }, []);

  const verifySignupOtp = useCallback(async (email, token) => {
    if (PROTOTYPE_AUTH) throw { message: 'OTP verification requires Supabase authentication.' };
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
    if (!otp.trim()) throw { message: 'Enter the verification code sent to your email.' };
    const verification = await supabase.auth.verifyOtp({ email: user?.email, token: otp.trim(), type: 'email' });
    if (verification.error) throw { message: verification.error.message };
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw { message: error.message };
  }, [user]);

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, verifySignupOtp, resendConfirmation, logout, updateUser, requestPasswordOtp, updatePassword, prototypeMode: PROTOTYPE_AUTH }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}
