import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import { env, isSupabaseConfigured } from '@/config/env';

const CHUNK = 1800;

async function getLarge(key: string): Promise<string | null> {
  if (Platform.OS === 'web') return globalThis.localStorage?.getItem(key) ?? null;
  const count = Number(await SecureStore.getItemAsync(`${key}.count`));
  if (!count) return null;
  let value = '';
  for (let index = 0; index < count; index += 1) {
    value += (await SecureStore.getItemAsync(`${key}.${index}`)) ?? '';
  }
  return value || null;
}

async function setLarge(key: string, value: string): Promise<void> {
  if (Platform.OS === 'web') {
    globalThis.localStorage?.setItem(key, value);
    return;
  }
  const previous = Number(await SecureStore.getItemAsync(`${key}.count`)) || 0;
  const count = Math.max(1, Math.ceil(value.length / CHUNK));
  await SecureStore.setItemAsync(`${key}.count`, String(count));
  for (let index = 0; index < count; index += 1) {
    await SecureStore.setItemAsync(`${key}.${index}`, value.slice(index * CHUNK, (index + 1) * CHUNK));
  }
  for (let index = count; index < previous; index += 1) {
    await SecureStore.deleteItemAsync(`${key}.${index}`);
  }
}

async function removeLarge(key: string): Promise<void> {
  if (Platform.OS === 'web') {
    globalThis.localStorage?.removeItem(key);
    return;
  }
  const count = Number(await SecureStore.getItemAsync(`${key}.count`)) || 0;
  await SecureStore.deleteItemAsync(`${key}.count`);
  for (let index = 0; index < count; index += 1) {
    await SecureStore.deleteItemAsync(`${key}.${index}`);
  }
}

const memory = new Map<string, string>();

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(env.supabaseUrl, env.supabaseAnonKey, {
      auth: {
        storage: {
          getItem: async (key) => (await getLarge(key)) ?? memory.get(key) ?? (await AsyncStorage.getItem(key)),
          setItem: async (key, value) => {
            memory.set(key, value);
            await setLarge(key, value);
          },
          removeItem: async (key) => {
            memory.delete(key);
            await removeLarge(key);
            await AsyncStorage.removeItem(key);
          },
        },
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
        flowType: 'pkce',
      },
    })
  : null;

export function requireSupabase(): SupabaseClient {
  if (!supabase) {
    throw new Error('Configure EXPO_PUBLIC_SUPABASE_URL e EXPO_PUBLIC_SUPABASE_ANON_KEY no arquivo .env.');
  }
  return supabase;
}

export function messageFrom(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === 'object' && error && 'message' in error) {
    const message = String((error as { message: unknown }).message);
    if (message && message !== 'null') return message;
  }
  return 'Algo deu errado. Tente novamente.';
}

export function authErrorMessage(reason: unknown): string {
  const raw = typeof reason === 'string' ? reason : messageFrom(reason);
  let text = raw;
  try {
    const parsed = JSON.parse(raw) as { msg?: string; message?: string; error_description?: string };
    text = parsed.msg || parsed.error_description || parsed.message || raw;
  } catch {
    text = raw;
  }
  if (text.includes('provider is not enabled') || text.includes('Unsupported provider')) {
    return 'O login com Google ainda não está ativado neste projeto Supabase. Entre com e-mail e senha.';
  }
  return text;
}

export async function invokeFunction<T>(name: string, body: Record<string, unknown>): Promise<T> {
  const client = requireSupabase();
  const { data, error } = await client.functions.invoke(name, { body });
  if (error) {
    let detail = messageFrom(error);
    const context = (error as { context?: { json?: () => Promise<{ error?: string }> } }).context;
    if (context?.json) {
      const payload = await context.json().catch(() => null);
      if (payload?.error) detail = payload.error;
    }
    throw new Error(detail);
  }
  return data as T;
}
