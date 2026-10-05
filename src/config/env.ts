export const env = {
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL?.trim() ?? '',
  supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? '',
  privacyContact: process.env.EXPO_PUBLIC_PRIVACY_CONTACT_EMAIL?.trim() ?? '',
  maxUploadBytes: Number(process.env.EXPO_PUBLIC_MAX_UPLOAD_BYTES) || 52_428_800,
};

export const isSupabaseConfigured = env.supabaseUrl.startsWith('https://') && env.supabaseAnonKey.length > 20;
