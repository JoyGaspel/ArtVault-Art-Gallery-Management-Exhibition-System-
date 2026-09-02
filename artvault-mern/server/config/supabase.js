const { createClient } = require('@supabase/supabase-js');

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_PUBLISHABLE_KEY;

// The publishable key is enough to validate a user's access token with Auth.
// Never put SUPABASE_SECRET_KEY in source control or send it to the browser.
const supabase = url && key ? createClient(url, key, { auth: { persistSession: false } }) : null;

module.exports = supabase;
