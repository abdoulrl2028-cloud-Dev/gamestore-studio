import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { Button, Card, Chip, Text } from 'react-native-paper';

import { EmptyState, ErrorState, LoadingState } from '@/components/ui';
import { GAME_STATUS_LABEL } from '@/domain/submission';
import { formatMoney } from '@/domain/money';
import { messageFrom, requireSupabase } from '@/lib/supabase';
import { GAME_FIELDS, type Game } from '@/types';

export default function AdminGamesScreen() {
  const [games, setGames] = useState<Game[]>([]);
  const [filter, setFilter] = useState<'all' | 'published' | 'rejected'>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    void (async () => {
      try {
        const { data, error: queryError } = await requireSupabase().from('games').select(GAME_FIELDS).order('updated_at', { ascending: false });
        if (queryError) throw queryError;
        setGames((data ?? []) as Game[]);
        setError('');
      } catch (reason) {
        setError(messageFrom(reason));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useFocusEffect(useCallback(() => {
    load();
  }, [load]));

  const setStatus = async (game: Game, status: Game['status']) => {
    const { error: updateError } = await requireSupabase()
      .from('games')
      .update({ status, published_at: status === 'published' ? new Date().toISOString() : game.published_at })
      .eq('id', game.id);
    if (updateError) setError(updateError.message);
    else load();
  };

  const remove = async (game: Game) => {
    const { error: deleteError } = await requireSupabase().from('games').delete().eq('id', game.id);
    if (deleteError) {
      setError('Não foi possível remover um jogo que já tem pedidos. Despublique-o.');
      return;
    }
    load();
  };

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Button mode="contained" onPress={() => router.push('/admin/games/new')}>Adicionar jogo</Button>
      <ScrollView horizontal contentContainerStyle={styles.filters}>
        <Chip selected={filter === 'all'} onPress={() => setFilter('all')}>Todos</Chip>
        <Chip selected={filter === 'published'} onPress={() => setFilter('published')}>Publicados</Chip>
        <Chip selected={filter === 'rejected'} onPress={() => setFilter('rejected')}>Rejeitados</Chip>
      </ScrollView>
      {games.filter((game) => filter === 'all' || game.status === filter).length === 0 ? <EmptyState title="Nenhum jogo nesta lista" body="Os jogos aparecem aqui conforme o status escolhido." /> : null}
      {games.filter((game) => filter === 'all' || game.status === filter).map((game) => (
        <Card key={game.id} mode="outlined">
          <Card.Title title={game.title} subtitle={`${GAME_STATUS_LABEL[game.status]} · ${formatMoney(game.price_cents, game.currency)} · v${game.current_version}`} />
          <Card.Actions>
            <Button onPress={() => router.push(`/admin/games/${game.id}`)}>Editar</Button>
            <Button onPress={() => setStatus(game, game.status === 'published' ? 'unpublished' : 'published')}>
              {game.status === 'published' ? 'Despublicar' : 'Publicar'}
            </Button>
            <Button onPress={() => remove(game)}>Remover</Button>
          </Card.Actions>
        </Card>
      ))}
      {error ? <Text>{error}</Text> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({ content: { padding: 16, gap: 12, paddingBottom: 32 }, filters: { gap: 8 } });
