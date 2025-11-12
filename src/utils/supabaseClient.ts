import { createClient } from '@supabase/supabase-js';
import { getSupabaseConfig } from './env';

const { url, anonKey } = getSupabaseConfig();

export const supabaseClient = url && anonKey ? createClient(url, anonKey) : undefined;
