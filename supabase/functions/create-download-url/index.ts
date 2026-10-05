import { corsHeaders, json } from '../_shared/http.ts';
import { createAdminClient, createUserClient } from '../_shared/supabase.ts';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PLATFORMS = new Set(['android', 'windows', 'linux', 'macos']);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Método não permitido.' }, 405);

  try {
    const userClient = createUserClient(req);
    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData.user) return json({ error: 'Faça login para baixar.' }, 401);

    const body = await req.json().catch(() => null);
    const gameId = typeof body?.gameId === 'string' ? body.gameId : '';
    const platform = typeof body?.platform === 'string' ? body.platform : 'android';
    if (!UUID.test(gameId) || !PLATFORMS.has(platform)) return json({ error: 'Pedido inválido.' }, 400);

    const admin = createAdminClient();
    const { data: owned, error: ownedError } = await admin
      .from('order_items')
      .select('game_id, orders!inner(user_id, status)')
      .eq('game_id', gameId)
      .eq('orders.user_id', userData.user.id)
      .eq('orders.status', 'paid')
      .limit(1);
    if (ownedError) return json({ error: ownedError.message }, 500);
    if (!owned || owned.length === 0) return json({ error: 'Compra não encontrada para este jogo.' }, 403);

    const { data: version, error: versionError } = await admin
      .from('game_versions')
      .select('id, version_name, storage_path, file_name')
      .eq('game_id', gameId)
      .eq('platform', platform)
      .eq('is_latest', true)
      .maybeSingle();
    if (versionError) return json({ error: versionError.message }, 500);
    if (!version?.storage_path) return json({ error: 'Ainda não há uma versão publicada para esta plataforma.' }, 404);

    const { data: signed, error: signError } = await admin.storage
      .from('game-files')
      .createSignedUrl(version.storage_path, 120);
    if (signError || !signed?.signedUrl) return json({ error: 'Não foi possível gerar o download.' }, 500);

    await admin.from('downloads').insert({
      user_id: userData.user.id,
      game_id: gameId,
      version_id: version.id,
    });
    await admin.from('audit_logs').insert({
      actor_id: userData.user.id,
      action: 'download_granted',
      entity: 'game_versions',
      entity_id: version.id,
      metadata: { game_id: gameId, platform },
    });

    return json({
      url: signed.signedUrl,
      expiresIn: 120,
      versionName: version.version_name,
      fileName: version.file_name,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha ao preparar o download.';
    return json({ error: message }, 500);
  }
});
