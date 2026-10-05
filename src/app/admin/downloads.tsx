import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { Card, Text } from 'react-native-paper';

import { EmptyState, ErrorState, LoadingState } from '@/components/ui';
import { messageFrom } from '@/lib/supabase';
import { listDownloads } from '@/services/store';

export default function DownloadsScreen() {
  const [rows, setRows] = useState<{ id: string; created_at: string; game_title: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    listDownloads()
      .then((next) => {
        setRows(next);
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
  if (rows.length === 0) return <EmptyState title="Nenhum download" body="Os downloads aparecem quando um comprador gera um link seguro." />;

  return (
    <ScrollView contentContainerStyle={styles.content}>
      {rows.map((row) => (
        <Card key={row.id} mode="outlined">
          <Card.Title title={row.game_title} subtitle={new Date(row.created_at).toLocaleString('pt-BR')} />
        </Card>
      ))}
      <Text>A lista mostra os últimos 100 downloads registrados.</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 10 },
});