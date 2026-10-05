import * as FileSystem from 'expo-file-system/legacy';

import { env } from '@/config/env';
import { safeFileName } from '@/domain/files';
import { invokeFunction, requireSupabase } from '@/lib/supabase';
import {
  GAME_FIELDS,
  type Category,
  type Game,
  type GameImage,
  type GameVersion,
  type GameVideo,
  type OrderRow,
  type PlatformName,
  type Profile,
  type Review,
} from '@/types';

export type ListedGame = Game & { category_ids: string[]; developer_name: string | null };

export async function listPublishedGames(): Promise<ListedGame[]> {
  const client = requireSupabase();
  const { data, error } = await client
    .from('games')
    .select(`${GAME_FIELDS}, game_categories(category_id)`)
    .eq('status', 'published')
    .order('published_at', { ascending: false });
  if (error) throw error;
  const names = await client.from('game_developers').select('game_id, display_name');
  if (names.error) throw names.error;
  const byGame = new Map((names.data ?? []).map((row) => [row.game_id as string, row.display_name as string]));
  return (data ?? []).map((row) => {
    const record = row as Game & { game_categories?: { category_id: string }[] };
    return {
      ...record,
      category_ids: (record.game_categories ?? []).map((item) => item.category_id),
      developer_name: byGame.get(record.id) ?? null,
    };
  });
}

export async function listCategories(): Promise<Category[]> {
  const { data, error } = await requireSupabase().from('categories').select('id, name, slug').order('name');
  if (error) throw error;
  return (data ?? []) as Category[];
}

export async function getGame(id: string): Promise<Game | null> {
  const { data, error } = await requireSupabase().from('games').select(GAME_FIELDS).eq('id', id).maybeSingle();
  if (error) throw error;
  return data as Game | null;
}

export async function getGameMedia(id: string): Promise<{ images: GameImage[]; videos: GameVideo[] }> {
  const client = requireSupabase();
  const [images, videos] = await Promise.all([
    client.from('game_images').select('id, storage_path, alt_text, sort_order').eq('game_id', id).order('sort_order'),
    client.from('game_videos').select('id, storage_path, external_url, title').eq('game_id', id),
  ]);
  if (images.error) throw images.error;
  if (videos.error) throw videos.error;
  return { images: (images.data ?? []) as GameImage[], videos: (videos.data ?? []) as GameVideo[] };
}

export async function listVersions(gameId: string): Promise<GameVersion[]> {
  const { data, error } = await requireSupabase()
    .from('game_versions')
    .select('id, game_id, version_name, changelog, file_name, file_size_bytes, platform, is_latest, published_at')
    .eq('game_id', gameId)
    .order('published_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as GameVersion[];
}

export async function listReviews(gameId: string): Promise<Review[]> {
  const { data, error } = await requireSupabase()
    .from('reviews')
    .select('id, rating, body, author_name, created_at, user_id')
    .eq('game_id', gameId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Review[];
}

export async function userOwnsGame(gameId: string, userId: string): Promise<boolean> {
  const { data, error } = await requireSupabase()
    .from('order_items')
    .select('game_id, orders!inner(user_id, status)')
    .eq('game_id', gameId)
    .eq('orders.user_id', userId)
    .eq('orders.status', 'paid')
    .limit(1);
  if (error) throw error;
  return (data ?? []).length > 0;
}

export type LibraryEntry = { game: Game; purchasedAt: string };

export async function listLibrary(userId: string): Promise<LibraryEntry[]> {
  const { data, error } = await requireSupabase()
    .from('order_items')
    .select(`game_id, orders!inner(user_id, status, created_at), games(${GAME_FIELDS})`)
    .eq('orders.user_id', userId)
    .eq('orders.status', 'paid');
  if (error) throw error;
  const games = new Map<string, LibraryEntry>();
  for (const row of data ?? []) {
    const record = row as unknown as {
      games: Game | Game[] | null;
      orders: { created_at: string } | { created_at: string }[] | null;
    };
    const game = Array.isArray(record.games) ? record.games[0] : record.games;
    const order = Array.isArray(record.orders) ? record.orders[0] : record.orders;
    if (!game) continue;
    const purchasedAt = order?.created_at ?? game.created_at;
    const existing = games.get(game.id);
    if (!existing || purchasedAt < existing.purchasedAt) games.set(game.id, { game, purchasedAt });
  }
  return [...games.values()];
}

export async function developerName(gameId: string): Promise<string | null> {
  const { data, error } = await requireSupabase().rpc('game_owner_name', { p_game_id: gameId });
  if (error) throw error;
  return (data as string | null) ?? null;
}

export async function listDownloads(): Promise<{ id: string; created_at: string; game_title: string }[]> {
  const { data, error } = await requireSupabase()
    .from('downloads')
    .select('id, created_at, games(title)')
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) throw error;
  return (data ?? []).map((row) => {
    const record = row as { id: string; created_at: string; games: { title: string } | { title: string }[] | null };
    const game = Array.isArray(record.games) ? record.games[0] : record.games;
    return { id: record.id, created_at: record.created_at, game_title: game?.title ?? 'Jogo removido' };
  });
}

export async function listOrders(): Promise<OrderRow[]> {
  const { data, error } = await requireSupabase()
    .from('orders')
    .select('id, status, subtotal_cents, discount_cents, total_cents, currency, payment_method, created_at, order_items(unit_price_cents, games(id, title))')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as OrderRow[];
}

export async function getOrder(id: string): Promise<OrderRow | null> {
  const { data, error } = await requireSupabase()
    .from('orders')
    .select('id, status, subtotal_cents, discount_cents, total_cents, currency, payment_method, created_at, order_items(unit_price_cents, games(id, title))')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data as unknown as OrderRow | null;
}

export async function quoteCoupon(code: string, subtotalCents: number): Promise<{ valid: boolean; discount_cents: number; message: string }> {
  const { data, error } = await requireSupabase().rpc('quote_coupon', { p_code: code, p_subtotal: subtotalCents });
  if (error) throw error;
  return data as { valid: boolean; discount_cents: number; message: string };
}

export async function startCheckout(input: {
  gameIds: string[];
  idempotencyKey: string;
  couponCode: string;
  paymentMethod: 'card' | 'pix';
}): Promise<{ orderId: string; status: string; url?: string }> {
  return invokeFunction('create-checkout', input);
}

export async function createDownload(gameId: string, platform: PlatformName): Promise<{
  url: string;
  expiresIn: number;
  versionName: string;
  fileName: string;
}> {
  return invokeFunction('create-download-url', { gameId, platform });
}

export async function saveProfileName(userId: string, displayName: string): Promise<void> {
  const { error } = await requireSupabase().from('profiles').update({ display_name: displayName }).eq('id', userId);
  if (error) throw error;
}

export async function deleteAccount(): Promise<void> {
  await invokeFunction('delete-account', { confirmation: 'EXCLUIR' });
}

export async function uploadToBucket(bucket: 'game-media' | 'game-files', path: string, uri: string, contentType: string): Promise<void> {
  const client = requireSupabase();
  const { data } = await client.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Faça login como administrador para enviar arquivos.');
  const encoded = path.split('/').map(encodeURIComponent).join('/');
  const result = await FileSystem.uploadAsync(`${env.supabaseUrl}/storage/v1/object/${bucket}/${encoded}`, uri, {
    httpMethod: 'POST',
    uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: env.supabaseAnonKey,
      'Content-Type': contentType || 'application/octet-stream',
      'x-upsert': 'true',
    },
  });
  if (result.status < 200 || result.status >= 300) {
    throw new Error(result.body || 'Falha no envio do arquivo.');
  }
}

export function buildStoragePath(gameId: string, folder: string, fileName: string): string {
  return `games/${gameId}/${folder}/${Date.now()}-${safeFileName(fileName)}`;
}

export async function listOwnGames(userId: string): Promise<Game[]> {
  const { data, error } = await requireSupabase()
    .from('games')
    .select(GAME_FIELDS)
    .or(`owner_id.eq.${userId},created_by.eq.${userId}`)
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Game[];
}

export async function listGamesByStatus(statuses: Game['status'][]): Promise<Game[]> {
  const { data, error } = await requireSupabase()
    .from('games')
    .select(GAME_FIELDS)
    .in('status', statuses)
    .order('submitted_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Game[];
}

export async function becomeDeveloper(): Promise<void> {
  const { error } = await requireSupabase().rpc('become_developer');
  if (error) throw error;
}

export async function submitOwnGame(gameId: string): Promise<void> {
  const { error } = await requireSupabase().rpc('submit_own_game', { p_game_id: gameId });
  if (error) throw error;
}

export async function reviewGame(gameId: string, action: 'approve' | 'reject' | 'request_changes' | 'start_review', note: string): Promise<void> {
  const { error } = await requireSupabase().rpc('admin_review_game', { p_game_id: gameId, p_action: action, p_note: note });
  if (error) throw error;
}

export async function attachOwnFile(input: {
  gameId: string;
  versionName: string;
  platform: PlatformName;
  storagePath: string;
  fileName: string;
  fileSizeBytes: number;
  contentType: string;
}): Promise<void> {
  const { error } = await requireSupabase().rpc('attach_own_game_file', {
    p_game_id: input.gameId,
    p_version_name: input.versionName,
    p_platform: input.platform,
    p_storage_path: input.storagePath,
    p_file_name: input.fileName,
    p_file_size_bytes: input.fileSizeBytes,
    p_content_type: input.contentType,
  });
  if (error) throw error;
}

export async function listProfiles(): Promise<Profile[]> {
  const { data, error } = await requireSupabase().from('profiles').select('id, email, display_name, role').order('created_at');
  if (error) throw error;
  return (data ?? []) as Profile[];
}
