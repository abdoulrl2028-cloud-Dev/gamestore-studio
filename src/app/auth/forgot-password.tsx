import * as Linking from 'expo-linking';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, HelperText, Text, TextInput } from 'react-native-paper';
import { z } from 'zod';

import { messageFrom, requireSupabase } from '@/lib/supabase';

const schema = z.email({ error: 'Informe um e-mail válido.' });

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    const parsed = schema.safeParse(email.trim());
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'E-mail inválido.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const { error: resetError } = await requireSupabase().auth.resetPasswordForEmail(parsed.data, {
        redirectTo: Linking.createURL('auth/reset'),
      });
      if (resetError) throw resetError;
      setInfo('Se o e-mail existir, enviamos um link para definir uma nova senha.');
    } catch (reason) {
      setError(messageFrom(reason));
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.content}>
      <Text variant="headlineSmall">Recuperar senha</Text>
      <TextInput mode="outlined" label="E-mail" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
      {error ? <HelperText type="error">{error}</HelperText> : null}
      {info ? <HelperText type="info">{info}</HelperText> : null}
      <Button mode="contained" loading={loading} onPress={submit}>Enviar link</Button>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 8 },
});
