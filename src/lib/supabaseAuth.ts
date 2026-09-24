import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '';

export const isSupabaseAuthConfigured = Boolean(
  supabaseUrl && 
  supabasePublishableKey && 
  supabaseUrl.startsWith('http')
);

// Cria o cliente Supabase Auth frontend exclusivamente com a chave pública
// Configurações obrigatórias: persistSession, autoRefreshToken, detectSessionInUrl
export const supabaseAuth: SupabaseClient = createClient(
  isSupabaseAuthConfigured ? supabaseUrl : 'https://placeholder.supabase.co',
  isSupabaseAuthConfigured ? supabasePublishableKey : 'placeholder-anon-key-prevent-init-crash',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: 'provapack_auth_token',
      flowType: 'implicit'
    }
  }
);
