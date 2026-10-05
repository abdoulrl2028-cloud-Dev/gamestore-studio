import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Button, Card, Text } from 'react-native-paper';

import { ErrorState, LoadingState } from '@/components/ui';
import { formatMoney } from '@/domain/money';
import { messageFrom, requireSupabase } from '@/lib/supabase';
import { listOrders, listProfiles } from '@/services/store';
import { GAME_FIELDS, type Game } from '@/types';

export default function AdminDashboard() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [stats, setStats] = useState({ games: 0, published: 0, users: 0, orders: 0, revenue: 'R$ 0,00' });

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      requireSupabase().from('games').select(GAME_FIELDS),
      listProfiles(),
      listOrders(),
    ])
      .then(([gamesResult, users, orders]) => {
        if (gamesResult.error) throw gamesResult.error;
        const games = (gamesResult.data ?? []) as Game[];
        const paid = orders.filter((order) => order.status === 'paid');
        const currency = paid[0]?.currency ?? 'brl';
        const revenue = paid.filter((order) => order.currency === currency).reduce((sum, order) => sum + order.total_cents, 0);
        setStats({
          games: games.length,
          published: games.filter((game) => game.status === 'published').length,
          users: users.length,
          orders: paid.length,
          revenue: formatMoney(revenue, currency),
        });
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

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.grid}>
        <Card style={styles.card}><Card.Title title="Jogos" subtitle={`${stats.published} publicados de ${stats.games}`} /></Card>
        <Card style={styles.card}><Card.Title title="Clientes" subtitle={String(stats.users)} /></Card>
        <Card style={styles.card}><Card.Title title="Vendas pagas" subtitle={String(stats.orders)} /></Card>
        <Card style={styles.card}><Card.Title title="Receita" subtitle={stats.revenue} /></Card>
      </View>
      <Button mode="contained" onPress={() => router.push('/admin/reviews')}>Jogos pendentes</Button>
      <Button mode="outlined" onPress={() => router.push('/admin/games')}>Jogos publicados e rejeitados</Button>
      <Button mode="outlined" onPress={() => router.push('/admin/downloads')}>Downloads</Button>
      <Button mode="contained" onPress={() => router.push('/admin/games/new')}>Adicionar jogo</Button>
      <Button mode="outlined" onPress={() => router.push('/admin/games')}>Gerenciar jogos</Button>
      <Button mode="outlined" onPress={() => router.push('/admin/orders')}>Pedidos</Button>
      <Button mode="outlined" onPress={() => router.push('/admin/users')}>Usuários</Button>
      <Button mode="outlined" onPress={() => router.push('/admin/sales')}>Vendas e receita</Button>
      <Button mode="outlined" onPress={() => router.push('/admin/coupons')}>Cupons</Button>
      <Button mode="outlined" onPress={() => router.push('/admin/categories')}>Categorias</Button>
      <Text>Os números vêm somente de pedidos com status pago.</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 10 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  card: { width: 168 },
});
