// src/utils/supabaseClient.ts
// Summary: Production-safe Supabase client with no fallback secrets.
// All credentials must come from Vercel environment variables.

import { createClient } from '@supabase/supabase-js';

// --- ENV VARIABLES (Vercel üzerinden gelmeli) ---
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// --- SAFETY CHECK ---
if (!supabaseUrl) {
  throw new Error(
    "Missing VITE_SUPABASE_URL. Add it to your Vercel environment variables."
  );
}

if (!supabaseAnonKey) {
  throw new Error(
    "Missing VITE_SUPABASE_ANON_KEY. Add it to your Vercel environment variables."
  );
}

// --- CREATE CLIENT (NO FALLBACKS) ---
export const supabaseClient = createClient(supabaseUrl, supabaseAnonKey);
