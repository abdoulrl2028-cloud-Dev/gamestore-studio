import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Text } from 'react-native-paper';

import { LoadingState } from '@/components/ui';
import { authErrorMessage, requireSupabase } from '@/lib/supabase';

function readParam(href: string, name: string): string {
  const query = href.split('?')[1]?.split('#')[0] ?? '';
  return new URLSearchParams(query).get(name) ?? '';
}

export default function AuthCallbackScreen() {
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    (async () => {
      const href = (await Linking.getInitialURL()) || Linking.getLinkingURL() || '';
      const description = readParam(href, 'error_description');
      const code = readParam(href, 'code');
      if (description) {
        if (active) setError(authErrorMessage(description));
        return;
      }
      if (!code) {
        if (active) setError('O retorno do login não trouxe o código de acesso.');
        return;
      }
      const { error: exchangeError } = await requireSupabase().auth.exchangeCodeForSession(code);
      if (!active) return;
      if (exchangeError) {
        setError(authErrorMessage(exchangeError));
        return;
      }
      router.replace('/');
    })().catch((reason) => {
      if (active) setError(authErrorMessage(reason));
    });
    return () => {
      active = false;
    };
  }, []);

  if (!error) return <LoadingState label="Concluindo o login..." />;

  return (
    <View style={styles.page}>
      <Text>{error}</Text>
      <Button mode="contained" onPress={() => router.replace('/auth/login')}>Voltar ao login</Button>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
});
