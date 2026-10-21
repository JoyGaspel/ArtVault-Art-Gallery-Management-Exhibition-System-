import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

// The publishable key is safe for browser use. Never put sb_secret_* here.
export const supabaseEnabled = Boolean(url && publishableKey);
export const supabase = supabaseEnabled ? createClient(url, publishableKey, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
}) : null;

// Password recovery verifies an OTP into a short-lived Supabase session.
// Keep it separate from the application's normal persistent sign-in session,
// so the login page cannot redirect before the new password has been saved.
export function createRecoveryClient() {
  if (!supabaseEnabled) return null;
  return createClient(url, publishableKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
      storageKey: 'artvault-password-recovery',
    },
  });
}

// Used only by the loopback offline workspace after the computer reconnects.
// Its session is memory-only and never becomes the browsing session.
export function createOfflineSyncClient() {
  if (!supabaseEnabled) return null;
  return createClient(url, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
