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
      const sessionUser = mapSupabaseUser(data.session?.user);
      if (data.session?.access_token) localStorage.setItem('artvault_token', data.session.access_token);
      if (data.session?.access_token) {
        api.get('/auth/me').then((response) => setUser(response.data.user)).catch(() => setUser(sessionUser)).finally(() => setLoading(false));
      } else {
        setUser(null);
        setLoading(false);
      }
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      const sessionUser = mapSupabaseUser(session?.user);
      if (session?.access_token) {
        localStorage.setItem('artvault_token', session.access_token);
        api.get('/auth/me').then((response) => setUser(response.data.user)).catch(() => setUser(sessionUser));
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

  const login = useCallback(async (email, password) => {
    if (PROTOTYPE_AUTH) {
      const prototypeUser = await prototypeLogin(email, password);
      setUser(prototypeUser);
      return prototypeUser;
    }
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw { message: error.message, code: error.code, status: error.status };
    const sessionUser = mapSupabaseUser(data.user);
    if (data.session?.access_token) localStorage.setItem('artvault_token', data.session.access_token);
    try {
      const response = await api.get('/auth/me');
      setUser(response.data.user);
      return response.data.user;
    } catch {
      setUser(sessionUser);
      return sessionUser;
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
        emailRedirectTo: `${window.location.origin}/login`,
      },
    });
    if (error) throw { message: error.message };
    const sessionUser = mapSupabaseUser(data.user);
    if (data.session) setUser(sessionUser);
    return { user: sessionUser, needsConfirmation: !data.session };
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

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, resendConfirmation, logout, updateUser, prototypeMode: PROTOTYPE_AUTH }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}
