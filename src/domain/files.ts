export const GAME_FILE_EXTENSIONS = [
  'apk',
  'aab',
  'zip',
  'exe',
  'obb',
  'xapk',
  '7z',
  'msi',
  'dmg',
  'tar',
  'gz',
  'appimage',
  'rar',
] as const;

const MEDIA_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp', 'mp4', 'webm', 'mov'] as const;

export function fileExtension(fileName: string): string {
  const clean = fileName.trim().toLowerCase().split('?')[0].split('#')[0];
  const parts = clean.split('.');
  return parts.length > 1 ? parts[parts.length - 1] : '';
}

export function isAllowedGameFile(fileName: string): boolean {
  return GAME_FILE_EXTENSIONS.includes(fileExtension(fileName) as (typeof GAME_FILE_EXTENSIONS)[number]);
}

export function isAllowedMediaFile(fileName: string): boolean {
  return MEDIA_EXTENSIONS.includes(fileExtension(fileName) as (typeof MEDIA_EXTENSIONS)[number]);
}

export function safeFileName(fileName: string): string {
  const base = fileName.split(/[/\\]/).pop() ?? 'arquivo';
  const cleaned = base.replace(/[^a-zA-Z0-9._-]+/g, '_').replace(/^_+|_+$/g, '');
  return cleaned.slice(0, 120) || 'arquivo';
}

export function isDirectVideo(url: string): boolean {
  return /\.(mp4|webm|mov)(\?|$)/i.test(url);
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return 'Tamanho não informado';
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = bytes;
  let index = 0;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }
  const digits = value >= 10 || index === 0 ? 0 : 1;
  return `${value.toFixed(digits)} ${units[index]}`;
}
