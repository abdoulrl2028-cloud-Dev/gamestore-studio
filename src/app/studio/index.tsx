import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { Button, Card, Text } from 'react-native-paper';

import { EmptyState, ErrorState, LoadingState } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { GAME_STATUS_LABEL } from '@/domain/submission';
import { formatMoney } from '@/domain/money';
import { mediaUrl } from '@/lib/media';
import { messageFrom, requireSupabase } from '@/lib/supabase';
import { listOwnGames, submitOwnGame } from '@/services/store';
import type { Game } from '@/types';

export default function MyGamesScreen() {
  const { session } = useAuth();
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const load = useCallback(() => {
    const userId = session?.user?.id;
    if (!userId) return;
    setLoading(true);
    listOwnGames(userId)
      .then((next) => {
        setGames(next);
        setError('');
      })
      .catch((reason) => setError(messageFrom(reason)))
      .finally(() => setLoading(false));
  }, [session?.user?.id]);

  useFocusEffect(useCallback(() => {
    load();
  }, [load]));

  const submit = async (game: Game) => {
    setBusyId(game.id);
    setNotice('');
    setError('');
    try {
      await submitOwnGame(game.id);
      setNotice('Seu jogo foi enviado para análise.');
      load();
    } catch (reason) {
      setError(messageFrom(reason));
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (game: Game) => {
    setBusyId(game.id);
    setError('');
    try {
      const { error: deleteError } = await requireSupabase().from('games').delete().eq('id', game.id);
      if (deleteError) throw deleteError;
      setConfirmDelete(null);
      setNotice('Rascunho excluído.');
      load();
    } catch (reason) {
      setError(messageFrom(reason));
    } finally {
      setBusyId(null);
    }
  };

  if (loading) return <LoadingState />;

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Button mode="contained" icon="plus" onPress={() => router.push('/studio/new')}>Publicar novo jogo</Button>
      {notice ? <Text>{notice}</Text> : null}
      {error ? <ErrorState message={error} onRetry={load} /> : null}
      {!error && games.length === 0 ? (
        <EmptyState title="Nenhum jogo seu" body="Publique um jogo para enviá-lo à análise do administrador." />
      ) : null}
      {games.map((game) => (
        <Card key={game.id} mode="outlined">
          <Image source={mediaUrl(game.cover_path) ? { uri: mediaUrl(game.cover_path)! } : undefined} style={styles.cover} contentFit="cover" />
          <Card.Title title={game.title} subtitle={`${GAME_STATUS_LABEL[game.status]} · ${formatMoney(game.price_cents, game.currency)}`} />
          <Card.Content style={styles.block}>
            <Text>Versão {game.current_version}</Text>
            <Text>Atualizado em {new Date(game.updated_at).toLocaleDateString('pt-BR')}</Text>
            {game.status === 'rejected' ? <Text>Seu jogo foi rejeitado. Consulte o motivo. {game.review_note}</Text> : null}
            {game.review_note && game.status === 'draft' ? <Text>Alterações pedidas: {game.review_note}</Text> : null}
          </Card.Content>
          <Card.Actions style={styles.actions}>
            {game.status === 'draft' || game.status === 'rejected' ? (
              <Button onPress={() => router.push(`/studio/${game.id}`)}>Editar</Button>
            ) : null}
            {game.status === 'draft' ? (
              confirmDelete === game.id ? (
                <Button textColor="#B3261E" loading={busyId === game.id} onPress={() => remove(game)}>Confirmar exclusão</Button>
              ) : (
                <Button onPress={() => setConfirmDelete(game.id)}>Excluir</Button>
              )
            ) : null}
            {game.status === 'draft' || game.status === 'rejected' ? (
              <Button loading={busyId === game.id} onPress={() => submit(game)}>Enviar para análise</Button>
            ) : null}
            <Button onPress={() => router.push(game.status === 'published' ? `/game/${game.id}` : `/studio/${game.id}`)}>Ver detalhes</Button>
            {game.status === 'published' || game.status === 'draft' || game.status === 'rejected' ? (
              <Button onPress={() => router.push(`/studio/${game.id}?focus=version`)}>Criar nova versão</Button>
            ) : null}
          </Card.Actions>
        </Card>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 12, paddingBottom: 40 },
  cover: { width: '100%', height: 160, backgroundColor: '#241F3D' },
  block: { gap: 4 },
  actions: { flexWrap: 'wrap' },
});
