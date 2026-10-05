import { router } from 'expo-router';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { getQueryParams } from 'expo-auth-session/build/QueryParams';
import { useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { Button, HelperText, Text, TextInput } from 'react-native-paper';

import { credentialsSchema, fieldErrors } from '@/domain/validation';
import { messageFrom, requireSupabase } from '@/lib/supabase';

function loginMessage(reason: unknown): string {
  const raw = messageFrom(reason);
  if (raw.includes('provider is not enabled') || raw.includes('Unsupported provider')) {
    return 'O login com Google ainda não está ativado neste projeto Supabase. Entre com e-mail e senha.';
  }
  return raw;
}

WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    const parsed = credentialsSchema.safeParse({ email, password });
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }
    setLoading(true);
    setFormError('');
    setErrors({});
    try {
      const { error } = await requireSupabase().auth.signInWithPassword(parsed.data);
      if (error) throw error;
      router.replace('/');
    } catch (reason) {
      setFormError(loginMessage(reason));
    } finally {
      setLoading(false);
    }
  };

  const google = async () => {
    setLoading(true);
    setFormError('');
    try {
      const redirectTo = Linking.createURL('auth/callback');
      const client = requireSupabase();
      const { data, error } = await client.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo, skipBrowserRedirect: true },
      });
      if (error) throw error;
      if (!data.url) throw new Error('O login com Google não está disponível.');
      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
      if (result.type !== 'success') return;
      const { params, errorCode } = getQueryParams(result.url);
      if (errorCode) throw new Error(params.error_description || errorCode);
      if (params.code) {
        const { error: exchangeError } = await client.auth.exchangeCodeForSession(params.code);
        if (exchangeError) throw exchangeError;
      } else if (params.access_token && params.refresh_token) {
        const { error: sessionError } = await client.auth.setSession({
          access_token: params.access_token,
          refresh_token: params.refresh_token,
        });
        if (sessionError) throw sessionError;
      }
      router.replace('/');
    } catch (reason) {
      setFormError(loginMessage(reason));
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text variant="headlineSmall">Entrar</Text>
      <TextInput mode="outlined" label="E-mail" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" error={Boolean(errors.email)} />
      {errors.email ? <HelperText type="error">{errors.email}</HelperText> : null}
      <TextInput mode="outlined" label="Senha" value={password} onChangeText={setPassword} secureTextEntry error={Boolean(errors.password)} />
      {errors.password ? <HelperText type="error">{errors.password}</HelperText> : null}
      {formError ? <HelperText type="error">{formError}</HelperText> : null}
      <Button mode="contained" loading={loading} onPress={submit}>Entrar</Button>
      <Button mode="outlined" loading={loading} onPress={google}>Continuar com Google</Button>
      <Button onPress={() => router.push('/auth/forgot-password')}>Esqueci a senha</Button>
      <Button onPress={() => router.push('/auth/register')}>Criar conta</Button>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 8 },
});
