import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
// Support new secret key (sb_secret_xxx) and legacy service_role key (eyJxxx)
const supabaseServiceKey =
  process.env.SUPABASE_SECRET_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY;

export function getSupabaseServerClient(): SupabaseClient | null {
  if (
    !supabaseUrl ||
    !supabaseServiceKey ||
    supabaseUrl.includes('your-project-id') ||
    supabaseServiceKey.includes('your-secret-key') ||
    supabaseServiceKey.includes('your-service-role-key')
  ) {
    return null;
  }
  
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
