import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.117.2';

function required(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`${name} não está configurada no servidor.`);
  return value;
}

export function createAdminClient(): SupabaseClient {
  return createClient(required('SUPABASE_URL'), required('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function createUserClient(req: Request): SupabaseClient {
  return createClient(required('SUPABASE_URL'), required('SUPABASE_ANON_KEY'), {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
