import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { Card, Text } from 'react-native-paper';

import { EmptyState, ErrorState, LoadingState } from '@/components/ui';
import { aggregateRevenue } from '@/domain/cart';
import { formatMoney } from '@/domain/money';
import { messageFrom } from '@/lib/supabase';
import { listOrders } from '@/services/store';

export default function SalesScreen() {
  const [rows, setRows] = useState<{ month: string; currency: string; totalCents: number; count: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    listOrders()
      .then((orders) => {
        const paid = orders.filter((order) => order.status === 'paid').map((order) => ({
          createdAt: order.created_at,
          totalCents: order.total_cents,
          currency: order.currency,
        }));
        setRows(aggregateRevenue(paid));
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
  if (rows.length === 0) return <EmptyState title="Sem receita ainda" body="A receita aparece quando um pagamento é confirmado pelo servidor." />;

  return (
    <ScrollView contentContainerStyle={styles.content}>
      {rows.map((row) => (
        <Card key={`${row.month}-${row.currency}`} mode="outlined">
          <Card.Title title={formatMoney(row.totalCents, row.currency)} subtitle={`${row.month} · ${row.count} pedido(s) pago(s)`} />
        </Card>
      ))}
      <Text>Cada linha agrupa os pedidos pagos do mês e da moeda.</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({ content: { padding: 16, gap: 12 } });
