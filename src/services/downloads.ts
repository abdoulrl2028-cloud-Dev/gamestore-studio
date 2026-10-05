import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

import { safeFileName } from '@/domain/files';
import { createDownload } from '@/services/store';
import type { PlatformName } from '@/types';

export async function downloadGame(
  gameId: string,
  platform: PlatformName,
  onProgress?: (fraction: number) => void,
): Promise<{ versionName: string; fileName: string }> {
  const grant = await createDownload(gameId, platform);
  const directory = FileSystem.cacheDirectory;
  if (!directory) throw new Error('Este aparelho não disponibilizou uma pasta temporária.');
  const destination = `${directory}${safeFileName(grant.fileName)}`;
  const task = FileSystem.createDownloadResumable(grant.url, destination, {}, (progress) => {
    const total = progress.totalBytesExpectedToWrite;
    if (total > 0) onProgress?.(progress.totalBytesWritten / total);
  });
  const result = await task.downloadAsync();
  if (!result?.uri) throw new Error('O download não foi concluído.');
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(result.uri);
  }
  return { versionName: grant.versionName, fileName: grant.fileName };
}
