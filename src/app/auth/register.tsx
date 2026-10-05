import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { Button, HelperText, Text, TextInput } from 'react-native-paper';

import { fieldErrors, registerSchema } from '@/domain/validation';
import { messageFrom, requireSupabase } from '@/lib/supabase';

export default function RegisterScreen() {
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    const parsed = registerSchema.safeParse({ displayName, email, password });
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }
    setLoading(true);
    setFormError('');
    setErrors({});
    try {
      const { data, error } = await requireSupabase().auth.signUp({
        email: parsed.data.email,
        password: parsed.data.password,
        options: { data: { display_name: parsed.data.displayName } },
      });
      if (error) throw error;
      if (data.session) {
        router.replace('/');
        return;
      }
      setInfo('Conta criada. Se a confirmação de e-mail estiver ativa, abra a mensagem antes de entrar.');
    } catch (reason) {
      setFormError(messageFrom(reason));
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text variant="headlineSmall">Criar conta</Text>
      <TextInput mode="outlined" label="Nome" value={displayName} onChangeText={setDisplayName} error={Boolean(errors.displayName)} />
      {errors.displayName ? <HelperText type="error">{errors.displayName}</HelperText> : null}
      <TextInput mode="outlined" label="E-mail" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" error={Boolean(errors.email)} />
      {errors.email ? <HelperText type="error">{errors.email}</HelperText> : null}
      <TextInput mode="outlined" label="Senha" value={password} onChangeText={setPassword} secureTextEntry error={Boolean(errors.password)} />
      {errors.password ? <HelperText type="error">{errors.password}</HelperText> : null}
      {formError ? <HelperText type="error">{formError}</HelperText> : null}
      {info ? <HelperText type="info">{info}</HelperText> : null}
      <Button mode="contained" loading={loading} onPress={submit}>Criar conta</Button>
      <Button onPress={() => router.push('/auth/login')}>Já tenho conta</Button>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 8 },
});
