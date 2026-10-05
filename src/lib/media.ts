import { env } from '@/config/env';

export function mediaUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (path.startsWith('https://')) return path;
  if (!env.supabaseUrl) return null;
  const encoded = path.split('/').map(encodeURIComponent).join('/');
  return `${env.supabaseUrl}/storage/v1/object/public/game-media/${encoded}`;
}
