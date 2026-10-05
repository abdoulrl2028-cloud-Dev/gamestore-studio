import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';

import { env } from '@/config/env';
import { formatBytes } from '@/domain/files';
import { requireSupabase } from '@/lib/supabase';

export type UploadProgress = {
  loaded: number;
  total: number;
  fraction: number;
  bytesPerSecond: number;
  label: string;
};

export type UploadHandle = {
  promise: Promise<void>;
  cancel: () => void;
};

type UploadInput = {
  bucket: 'game-media' | 'game-files';
  path: string;
  uri: string;
  file?: Blob;
  contentType: string;
  size?: number;
  onProgress: (progress: UploadProgress) => void;
};

function progressLabel(loaded: number, total: number, bytesPerSecond: number): string {
  const percent = total > 0 ? Math.min(100, Math.round((loaded / total) * 100)) : 0;
  const speed = bytesPerSecond > 0 ? `${formatBytes(bytesPerSecond)}/s` : 'calculando velocidade';
  return `${percent}% · ${formatBytes(loaded)} de ${formatBytes(total)} · ${speed}`;
}

export function assertUploadSize(size: number | undefined): void {
  if (size === undefined) return;
  if (size > env.maxUploadBytes) {
    throw new Error(`O arquivo é muito grande. O limite atual é ${formatBytes(env.maxUploadBytes)}.`);
  }
}

export function startUpload(input: UploadInput): UploadHandle {
  assertUploadSize(input.size);
  if (Platform.OS === 'web' && input.file) return uploadWithXhr(input);
  return uploadWithFileSystem(input);
}

function uploadWithXhr(input: UploadInput): UploadHandle {
  const xhr = new XMLHttpRequest();
  let settled = false;
  const started = Date.now();
  const promise = new Promise<void>((resolve, reject) => {
    requireSupabase().auth.getSession().then(({ data }) => {
      const token = data.session?.access_token;
      if (!token) {
        reject(new Error('Faça login para publicar um jogo.'));
        return;
      }
      const encoded = input.path.split('/').map(encodeURIComponent).join('/');
      xhr.open('POST', `${env.supabaseUrl}/storage/v1/object/${input.bucket}/${encoded}`);
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      xhr.setRequestHeader('apikey', env.supabaseAnonKey);
      xhr.setRequestHeader('Content-Type', input.contentType || 'application/octet-stream');
      xhr.setRequestHeader('x-upsert', 'true');
      xhr.upload.onprogress = (event) => {
        const total = event.lengthComputable ? event.total : input.size ?? event.loaded;
        const elapsed = Math.max((Date.now() - started) / 1000, 0.001);
        const bytesPerSecond = event.loaded / elapsed;
        input.onProgress({
          loaded: event.loaded,
          total,
          fraction: total > 0 ? event.loaded / total : 0,
          bytesPerSecond,
          label: progressLabel(event.loaded, total, bytesPerSecond),
        });
      };
      xhr.onload = () => {
        settled = true;
        if (xhr.status >= 200 && xhr.status < 300) resolve();
        else reject(new Error(xhr.responseText || 'Falha no envio do arquivo.'));
      };
      xhr.onerror = () => {
        settled = true;
        reject(new Error('Falha no envio do arquivo.'));
      };
      xhr.onabort = () => {
        settled = true;
        reject(new Error('Envio cancelado.'));
      };
      xhr.send(input.file ?? null);
    }).catch(reject);
  });
  return {
    promise,
    cancel: () => {
      if (!settled) xhr.abort();
    },
  };
}

function uploadWithFileSystem(input: UploadInput): UploadHandle {
  let task: FileSystem.UploadTask | null = null;
  const started = Date.now();
  const promise = (async () => {
    const { data } = await requireSupabase().auth.getSession();
    const token = data.session?.access_token;
    if (!token) throw new Error('Faça login para publicar um jogo.');
    const encoded = input.path.split('/').map(encodeURIComponent).join('/');
    task = FileSystem.createUploadTask(
      `${env.supabaseUrl}/storage/v1/object/${input.bucket}/${encoded}`,
      input.uri,
      {
        httpMethod: 'POST',
        uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
        headers: {
          Authorization: `Bearer ${token}`,
          apikey: env.supabaseAnonKey,
          'Content-Type': input.contentType || 'application/octet-stream',
          'x-upsert': 'true',
        },
      },
      (event) => {
        const total = event.totalBytesExpectedToSend || input.size || event.totalBytesSent;
        const elapsed = Math.max((Date.now() - started) / 1000, 0.001);
        const bytesPerSecond = event.totalBytesSent / elapsed;
        input.onProgress({
          loaded: event.totalBytesSent,
          total,
          fraction: total > 0 ? event.totalBytesSent / total : 0,
          bytesPerSecond,
          label: progressLabel(event.totalBytesSent, total, bytesPerSecond),
        });
      },
    );
    const result = await task.uploadAsync();
    if (!result || result.status < 200 || result.status >= 300) {
      throw new Error(result?.body || 'Falha no envio do arquivo.');
    }
  })();
  return {
    promise,
    cancel: () => {
      task?.cancelAsync().catch(() => undefined);
    },
  };
}
