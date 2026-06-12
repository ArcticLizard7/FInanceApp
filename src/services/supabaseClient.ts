import { createClient } from '@supabase/supabase-js';
import { isSupabaseConfigured, runtimeConfig } from '@/config/runtime';

export const supabase = isSupabaseConfigured
  ? createClient(runtimeConfig.supabaseUrl!, runtimeConfig.supabaseAnonKey!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

export function requireSupabase() {
  if (!supabase) {
    throw new Error('Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
  }
  return supabase;
}
