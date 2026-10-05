import { corsHeaders, json } from '../_shared/http.ts';
import { createAdminClient, createUserClient } from '../_shared/supabase.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Método não permitido.' }, 405);

  try {
    const userClient = createUserClient(req);
    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData.user) return json({ error: 'Faça login para excluir a conta.' }, 401);

    const body = await req.json().catch(() => null);
    if (body?.confirmation !== 'EXCLUIR') {
      return json({ error: 'Digite EXCLUIR para confirmar.' }, 400);
    }

    const admin = createAdminClient();
    const { count } = await admin
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('role', 'admin')
      .is('deleted_at', null);
    const { data: profile } = await admin.from('profiles').select('role').eq('id', userData.user.id).maybeSingle();
    if (profile?.role === 'admin' && (count ?? 0) <= 1) {
      return json({ error: 'Cadastre outro administrador antes de excluir esta conta.' }, 409);
    }

    const { error } = await admin.auth.admin.deleteUser(userData.user.id);
    if (error) return json({ error: error.message }, 400);
    return json({ deleted: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Não foi possível excluir a conta.';
    return json({ error: message }, 500);
  }
});
