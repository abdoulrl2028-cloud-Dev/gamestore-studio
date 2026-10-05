import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { Button, Card, Text } from 'react-native-paper';

import { EmptyState, ErrorState, LoadingState } from '@/components/ui';
import { formatMoney } from '@/domain/money';
import { messageFrom, requireSupabase } from '@/lib/supabase';
import { listOrders } from '@/services/store';
import type { OrderRow } from '@/types';

export default function AdminOrdersScreen() {
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    listOrders()
      .then((next) => {
        setOrders(next);
        setError('');
      })
      .catch((reason) => setError(messageFrom(reason)))
      .finally(() => setLoading(false));
  }, []);

  useFocusEffect(useCallback(() => {
    load();
  }, [load]));

  const cancel = async (orderId: string) => {
    const { error: cancelError } = await requireSupabase().rpc('admin_cancel_order', { p_order_id: orderId });
    if (cancelError) setError(cancelError.message);
    else load();
  };

  if (loading) return <LoadingState />;
  if (error && orders.length === 0) return <ErrorState message={error} onRetry={load} />;

  return (
    <ScrollView contentContainerStyle={styles.content}>
      {orders.length === 0 ? <EmptyState title="Nenhum pedido" body="As compras confirmadas e as pendentes aparecem aqui." /> : null}
      {error ? <Text>{error}</Text> : null}
      {orders.map((order) => (
        <Card key={order.id} mode="outlined">
          <Card.Title title={formatMoney(order.total_cents, order.currency)} subtitle={`${order.status} · ${order.payment_method} · ${new Date(order.created_at).toLocaleString('pt-BR')}`} />
          <Card.Content>
            <Text>{(order.order_items ?? []).map((item) => item.games?.title ?? 'Jogo').join(', ')}</Text>
          </Card.Content>
          {order.status === 'pending' ? <Card.Actions><Button onPress={() => cancel(order.id)}>Cancelar pendente</Button></Card.Actions> : null}
        </Card>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({ content: { padding: 16, gap: 12 } });
