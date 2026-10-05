import { Image } from 'expo-image';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Linking, ScrollView, StyleSheet } from 'react-native';
import { Button, HelperText, Text, TextInput } from 'react-native-paper';

import { EmptyState, ErrorState, LoadingState } from '@/components/ui';
import { formatBytes } from '@/domain/files';
import { formatMoney } from '@/domain/money';
import { GAME_STATUS_LABEL } from '@/domain/submission';
import { mediaUrl } from '@/lib/media';
import { messageFrom } from '@/lib/supabase';
import { developerName, getGame, getGameMedia, listVersions, reviewGame } from '@/services/store';
import type { Game, GameImage, GameVersion, GameVideo } from '@/types';

export default function ReviewGameScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [game, setGame] = useState<Game | null>(null);
  const [images, setImages] = useState<GameImage[]>([]);
  const [videos, setVideos] = useState<GameVideo[]>([]);
  const [versions, setVersions] = useState<GameVersion[]>([]);
  const [developer, setDeveloper] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const load = useCallback(() => {
    if (!id) return;
    setLoading(true);
    Promise.all([getGame(id), getGameMedia(id), listVersions(id), developerName(id)])
      .then(([nextGame, media, nextVersions, name]) => {
        setGame(nextGame);
        setImages(media.images);
        setVideos(media.videos);
        setVersions(nextVersions);
        setDeveloper(name);
        setError('');
      })
      .catch((reason) => setError(messageFrom(reason)))
      .finally(() => setLoading(false));
  }, [id]);

  useFocusEffect(useCallback(() => {
    load();
  }, [load]));

  const act = async (action: 'approve' | 'reject' | 'request_changes' | 'start_review') => {
    if (!id) return;
    if ((action === 'reject' || action === 'request_changes') && note.trim().length < 5) {
      setError('Informe o motivo com pelo menos 5 caracteres.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await reviewGame(id, action, note);
      setMessage(action === 'approve' ? 'Seu jogo foi aprovado.' : action === 'reject' ? 'Jogo rejeitado. O desenvolvedor verá o motivo.' : 'Pedido registrado.');
      load();
    } catch (reason) {
      setError(messageFrom(reason));
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <LoadingState />;
  if (error && !game) return <ErrorState message={error} onRetry={load} />;
  if (!game) return <EmptyState title="Jogo não encontrado" body="Ele pode ter sido removido." />;

  const trailer = videos[0];

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Image source={mediaUrl(game.cover_path) ? { uri: mediaUrl(game.cover_path)! } : undefined} style={styles.cover} contentFit="cover" />
      <Text variant="headlineSmall">{game.title}</Text>
      <Text>{GAME_STATUS_LABEL[game.status]} · {formatMoney(game.price_cents, game.currency)} · versão {game.current_version}</Text>
      <Text>Desenvolvedor: {developer ?? game.owner_id ?? 'Conta sem nome público'}</Text>
      <Text>{game.description}</Text>
      <Text>Requisitos mínimos: {game.min_requirements}</Text>
      <Text>Requisitos recomendados: {game.recommended_requirements}</Text>
      <Text>Política de privacidade: {game.privacy_policy_url ?? 'Não informada'}</Text>
      {game.privacy_policy_url ? <Button onPress={() => Linking.openURL(game.privacy_policy_url!)}>Abrir política</Button> : null}
      <Text variant="titleMedium">Screenshots</Text>
      {images.length === 0 ? <Text>Nenhuma captura.</Text> : images.map((image) => (
        <Image key={image.id} source={{ uri: mediaUrl(image.storage_path) ?? '' }} style={styles.shot} contentFit="cover" />
      ))}
      <Text variant="titleMedium">Trailer</Text>
      {trailer?.external_url ? <Button onPress={() => Linking.openURL(trailer.external_url!)}>Abrir trailer</Button> : <Text>{trailer?.storage_path ? 'Arquivo de trailer enviado.' : 'Nenhum trailer.'}</Text>}
      <Text variant="titleMedium">Arquivos</Text>
      {versions.length === 0 ? <Text>Nenhum arquivo enviado.</Text> : versions.map((version) => (
        <Text key={version.id}>{version.version_name} · {version.platform} · {version.file_name} · {formatBytes(version.file_size_bytes)}</Text>
      ))}
      <TextInput mode="outlined" label="Motivo, obrigatório para rejeitar" value={note} onChangeText={setNote} multiline />
      <Button mode="contained" loading={busy} onPress={() => act('approve')}>Aprovar</Button>
      <Button mode="outlined" loading={busy} onPress={() => act('start_review')}>Marcar em análise</Button>
      <Button mode="outlined" loading={busy} onPress={() => act('request_changes')}>Solicitar alterações</Button>
      <Button mode="outlined" loading={busy} onPress={() => act('reject')}>Rejeitar</Button>
      {message ? <HelperText type="info">{message}</HelperText> : null}
      {error ? <HelperText type="error">{error}</HelperText> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 10, paddingBottom: 40 },
  cover: { width: '100%', height: 200, borderRadius: 12, backgroundColor: '#241F3D' },
  shot: { width: '100%', height: 160, borderRadius: 12, backgroundColor: '#241F3D' },
});
