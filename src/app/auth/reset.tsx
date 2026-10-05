import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, HelperText, Text, TextInput } from 'react-native-paper';

import { messageFrom, requireSupabase, supabase } from '@/lib/supabase';

export default function ResetPasswordScreen() {
  const [password, setPassword] = useState('');
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setReady(Boolean(data.session)));
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || session) setReady(true);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const submit = async () => {
    if (password.length < 8) {
      setError('A senha precisa ter pelo menos 8 caracteres.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const { error: updateError } = await requireSupabase().auth.updateUser({ password });
      if (updateError) throw updateError;
      router.replace('/');
    } catch (reason) {
      setError(messageFrom(reason));
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.content}>
      <Text variant="headlineSmall">Nova senha</Text>
      <Text>{ready ? 'Defina uma senha nova para a sua conta.' : 'Abra o link recebido por e-mail neste aparelho e volte para esta tela.'}</Text>
      <TextInput mode="outlined" label="Nova senha" value={password} onChangeText={setPassword} secureTextEntry />
      {error ? <HelperText type="error">{error}</HelperText> : null}
      <Button mode="contained" loading={loading} disabled={!ready} onPress={submit}>Salvar senha</Button>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 8 },
});
