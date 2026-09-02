import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

// The publishable key is safe for browser use. Never put sb_secret_* here.
export const supabaseEnabled = Boolean(url && publishableKey);
export const supabase = supabaseEnabled ? createClient(url, publishableKey) : null;
