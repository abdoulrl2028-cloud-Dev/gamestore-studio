import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { Button, Card, Text } from 'react-native-paper';

import { EmptyState, ErrorState, LoadingState } from '@/components/ui';
import { GAME_STATUS_LABEL } from '@/domain/submission';
import { formatMoney } from '@/domain/money';
import { messageFrom } from '@/lib/supabase';
import { listGamesByStatus } from '@/services/store';
import type { Game } from '@/types';

export default function PendingReviewsScreen() {
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    listGamesByStatus(['submitted', 'in_review'])
      .then((next) => {
        setGames(next);
        setError('');
      })
      .catch((reason) => setError(messageFrom(reason)))
      .finally(() => setLoading(false));
  }, []);

  useFocusEffect(useCallback(() => {
    load();
  }, [load]));

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (games.length === 0) return <EmptyState title="Nenhum jogo pendente" body="Quando um desenvolvedor enviar um jogo, ele aparece aqui." />;

  return (
    <ScrollView contentContainerStyle={styles.content}>
      {games.map((game) => (
        <Card key={game.id} mode="outlined">
          <Card.Title title={game.title} subtitle={`${GAME_STATUS_LABEL[game.status]} · ${formatMoney(game.price_cents, game.currency)}`} />
          <Card.Content><Text>Versão {game.current_version}</Text></Card.Content>
          <Card.Actions>
            <Button onPress={() => router.push(`/admin/reviews/${game.id}`)}>Analisar</Button>
          </Card.Actions>
        </Card>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 12 },
});
