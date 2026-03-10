import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// We export a function to get the client, or a constant that might be null
// to avoid crashing at module load time if keys are missing.
export const supabase: SupabaseClient = (supabaseUrl && supabaseAnonKey) 
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null as any;

export const isSupabaseConfigured = !!(supabaseUrl && supabaseAnonKey);
