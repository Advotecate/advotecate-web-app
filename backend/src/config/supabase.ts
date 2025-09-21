import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from './index.js';

// Create Supabase client for admin operations
export const supabaseAdmin: SupabaseClient = createClient(
  config.supabase.url,
  config.supabase.serviceRoleKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

// Create Supabase client with anon key (for client-side operations)
export const supabaseClient: SupabaseClient = createClient(
  config.supabase.url,
  config.supabase.anonKey
);

// Helper function to create client with user session
export const createSupabaseClient = (accessToken?: string): SupabaseClient => {
  const client = createClient(config.supabase.url, config.supabase.anonKey);

  if (accessToken) {
    client.auth.setSession({
      access_token: accessToken,
      refresh_token: '', // We manage refresh tokens separately
    } as any);
  }

  return client;
};

export default supabaseAdmin;