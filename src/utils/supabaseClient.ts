// src/utils/supabaseClient.ts
import { createClient } from '@supabase/supabase-js';

// --- FALLBACKS (HER ORTAMDA ÇALIŞIR) ---
const FALLBACK_SUPABASE_URL = "https://sljxmsydtnnvimbslarp.supabase.co";

const FALLBACK_SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNsanhtc3lkdG5udmltYnNsYXJwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI0MzY0MTUsImV4cCI6MjA3ODAxMjQxNX0.-kAgY7d0CREjRf5YT_M5FhSzJ3vqUgzqfPo1igx9ffk";

// --- ENV ÜZERİNDEN OKU, YOKSA FALLBACK KULLAN ---
const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL || FALLBACK_SUPABASE_URL;

const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY || FALLBACK_SUPABASE_ANON_KEY;

// --- SAFETY CHECK ---
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Supabase configuration missing.");
}

export const supabaseClient = createClient(supabaseUrl, supabaseAnonKey);
