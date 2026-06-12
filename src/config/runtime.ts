const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
const isSupabaseReady = Boolean(supabaseUrl && supabaseAnonKey);
const explicitDemoAuth = import.meta.env.VITE_ENABLE_DEMO_AUTH === 'true';

export const runtimeConfig = {
  isProduction: import.meta.env.PROD,
  supabaseUrl,
  supabaseAnonKey,
  enableDemoAuth: explicitDemoAuth || (import.meta.env.DEV && !isSupabaseReady),
};

export const isSupabaseConfigured = Boolean(
  runtimeConfig.supabaseUrl &&
  runtimeConfig.supabaseAnonKey
);

export const useSupabaseBackend =
  isSupabaseConfigured &&
  !runtimeConfig.enableDemoAuth;

export const isProductionAuthBlocked =
  runtimeConfig.isProduction &&
  !runtimeConfig.enableDemoAuth &&
  !isSupabaseConfigured;
