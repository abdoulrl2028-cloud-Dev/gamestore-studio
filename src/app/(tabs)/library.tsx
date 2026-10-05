import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { Button, Card, Text } from 'react-native-paper';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';

import { EmptyState, ErrorState, LoadingState, SectionTitle } from '@/components/ui';
import { compareVersions } from '@/domain/versions';
import { mediaUrl } from '@/lib/media';
import { messageFrom } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { listLibrary, listVersions, type LibraryEntry } from '@/services/store';
import { downloadGame } from '@/services/downloads';
import type { GameVersion } from '@/types';

const INSTALLS_KEY = 'gamestore.installs';

export default function LibraryScreen() {
  const { session } = useAuth();
  const [games, setGames] = useState<LibraryEntry[]>([]);
  const [versions, setVersions] = useState<Record<string, GameVersion[]>>({});
  const [installed, setInstalled] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [progress, setProgress] = useState('');

  const load = useCallback(() => {
    if (!session?.user) {
      setLoading(false);
      setGames([]);
      return;
    }
    setLoading(true);
    listLibrary(session.user.id)
      .then(async (nextGames) => {
        const entries = await Promise.all(nextGames.map(async (entry) => [entry.game.id, await listVersions(entry.game.id)] as const));
        const stored = await AsyncStorage.getItem(INSTALLS_KEY);
        setGames(nextGames);
        setVersions(Object.fromEntries(entries));
        setInstalled(stored ? JSON.parse(stored) as Record<string, string> : {});
        setError(null);
      })
      .catch((reason) => setError(messageFrom(reason)))
      .finally(() => setLoading(false));
  }, [session?.user?.id]);

  useFocusEffect(useCallback(() => {
    load();
  }, [load]));

  const onDownload = async (entry: LibraryEntry) => {
    const game = entry.game;
    const latest = (versions[game.id] ?? []).find((version) => version.is_latest) ?? versions[game.id]?.[0];
    if (!latest) {
      setError('Este jogo ainda não tem uma versão publicada.');
      return;
    }
    setBusyId(game.id);
    setError(null);
    try {
      const saved = await downloadGame(game.id, latest.platform, (fraction) => {
        setProgress(`${game.title}: ${Math.round(fraction * 100)}%`);
      });
      const next = { ...installed, [game.id]: saved.versionName };
      setInstalled(next);
      await AsyncStorage.setItem(INSTALLS_KEY, JSON.stringify(next));
      setProgress(`Download concluído: ${saved.fileName}`);
    } catch (reason) {
      setError(messageFrom(reason));
    } finally {
      setBusyId(null);
    }
  };

  if (!session) {
    return (
      <SafeAreaView style={styles.page} edges={['top']}>
        <EmptyState
          title="Entre para ver sua biblioteca"
          body="Os jogos comprados ficam ligados à sua conta."
          action={<Button mode="contained" onPress={() => router.push('/auth/login')}>Entrar</Button>}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.page} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <SectionTitle>Biblioteca</SectionTitle>
        {progress ? <Text>{progress}</Text> : null}
        {loading ? <LoadingState /> : null}
        {error ? <ErrorState message={error} onRetry={load} /> : null}
        {!loading && !error && games.length === 0 ? (
          <EmptyState title="Nenhum jogo comprado" body="Depois que o pagamento for confirmado, o jogo aparece aqui." action={<Button mode="contained" onPress={() => router.push('/catalog')}>Ver catálogo</Button>} />
        ) : null}
        {games.map((entry) => {
          const game = entry.game;
          const history = versions[game.id] ?? [];
          const latest = history.find((version) => version.is_latest)?.version_name ?? game.current_version;
          const local = installed[game.id];
          const needsUpdate = Boolean(local && compareVersions(latest, local) > 0);
          return (
            <Card key={game.id} mode="outlined">
              <Image source={mediaUrl(game.cover_path) ? { uri: mediaUrl(game.cover_path)! } : undefined} style={styles.cover} contentFit="cover" />
              <Card.Title title={game.title} subtitle={game.genre} />
              <Card.Content style={styles.block}>
                <Text>Versão disponível: {latest}</Text>
                <Text>Comprado em {new Date(entry.purchasedAt).toLocaleDateString('pt-BR')}</Text>
                <Text>Versão baixada neste aparelho: {local ?? 'Nenhuma'}</Text>
                <Text variant="titleSmall">Histórico</Text>
                {history.length === 0 ? <Text>Nenhuma versão publicada.</Text> : history.map((version) => (
                  <Text key={version.id}>{version.version_name} · {version.platform}{version.is_latest ? ' · mais recente' : ''}</Text>
                ))}
              </Card.Content>
              <Card.Actions>
                <Button mode="contained" loading={busyId === game.id} onPress={() => onDownload(entry)}>
                  {needsUpdate ? 'Atualizar' : 'Baixar'}
                </Button>
                <Button onPress={() => router.push(`/game/${game.id}`)}>Abrir página</Button>
              </Card.Actions>
            </Card>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  content: { padding: 16, gap: 12, paddingBottom: 32 },
  block: { gap: 6 },
  cover: { width: '100%', height: 140, backgroundColor: '#241F3D' },
});
