import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { Button, Card, SegmentedButtons, Text, TextInput } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmptyState, SectionTitle } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { fieldErrors } from '@/domain/validation';
import { messageFrom } from '@/lib/supabase';
import { saveProfileName } from '@/services/store';
import { useThemeChoice, type ThemeChoice } from '@/theme/theme';
import { z } from 'zod';

const nameSchema = z.string().trim().min(2, { error: 'Informe seu nome.' }).max(80);

export default function ProfileScreen() {
  const { session, profile, signOut, refreshProfile } = useAuth();
  const { choice, setChoice } = useThemeChoice();
  const [name, setName] = useState(profile?.display_name ?? '');
  const [error, setError] = useState('');
  const [saved, setSaved] = useState('');
  const [loading, setLoading] = useState(false);

  if (!session || !profile) {
    return (
      <SafeAreaView style={styles.page} edges={['top']}>
        <EmptyState
          title="Sua conta"
          body="Entre para ver compras, biblioteca e configurações."
          action={<Button mode="contained" onPress={() => router.push('/auth/login')}>Entrar</Button>}
        />
      </SafeAreaView>
    );
  }

  const save = async () => {
    const parsed = nameSchema.safeParse(name);
    if (!parsed.success) {
      setError(fieldErrors(parsed.error).name ?? parsed.error.issues[0]?.message ?? 'Nome inválido.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await saveProfileName(profile.id, parsed.data);
      await refreshProfile();
      setSaved('Nome atualizado.');
    } catch (reason) {
      setError(messageFrom(reason));
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.page} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <SectionTitle>Perfil</SectionTitle>
        <Text>E-mail: {profile.email ?? session.user.email}</Text>
        <TextInput mode="outlined" label="Nome" value={name || profile.display_name} onChangeText={setName} />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {saved ? <Text>{saved}</Text> : null}
        <Button mode="contained" loading={loading} onPress={save}>Salvar nome</Button>
        <Card mode="outlined">
          <Card.Content style={styles.block}>
            <Text variant="titleMedium">Configurações</Text>
            <Text>Tema</Text>
            <SegmentedButtons
              value={choice}
              onValueChange={(value) => setChoice(value as ThemeChoice)}
              buttons={[
                { value: 'system', label: 'Sistema' },
                { value: 'light', label: 'Claro' },
                { value: 'dark', label: 'Escuro' },
              ]}
            />
          </Card.Content>
        </Card>
        <Button mode="contained" onPress={() => router.push('/studio')}>Meus jogos</Button>
        <Button mode="outlined" onPress={() => router.push('/library')}>Biblioteca</Button>
        <Button mode="outlined" onPress={() => router.push('/checkout')}>Histórico no checkout</Button>
        <Button mode="outlined" onPress={() => router.push('/legal/privacy')}>Política de privacidade</Button>
        <Button mode="outlined" onPress={() => router.push('/legal/terms')}>Termos de uso</Button>
        <Button mode="outlined" onPress={() => router.push('/legal/delete-account')}>Excluir conta</Button>
        {profile.role === 'admin' ? <Button mode="contained" onPress={() => router.push('/admin')}>Painel administrativo</Button> : null}
        <Button mode="text" onPress={() => signOut().catch((reason) => setError(messageFrom(reason)))}>Sair</Button>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  content: { padding: 16, gap: 12, paddingBottom: 32 },
  block: { gap: 8 },
  error: { color: '#B3261E' },
});
