import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Text } from 'react-native-paper';

import { ErrorState, LoadingState } from '@/components/ui';
import { useCart } from '@/context/CartContext';
import { formatMoney } from '@/domain/money';
import { messageFrom, requireSupabase } from '@/lib/supabase';
import { getOrder } from '@/services/store';
import type { OrderRow } from '@/types';

export default function CheckoutResultScreen() {
  const { order_id: orderId, outcome } = useLocalSearchParams<{ order_id?: string; outcome?: string }>();
  const cart = useCart();
  const [order, setOrder] = useState<OrderRow | null>(null);
  const [error, setError] = useState(orderId ? '' : 'Pedido não informado.');
  const [waiting, setWaiting] = useState(Boolean(orderId));

  useEffect(() => {
    if (!orderId) return;
    let attempts = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const poll = async () => {
      try {
        const next = await getOrder(orderId);
        setOrder(next);
        if (next?.status === 'paid') {
          cart.clear();
          setWaiting(false);
          return;
        }
        if (outcome === 'cancel' && next?.status === 'pending') {
          await requireSupabase().rpc('cancel_own_pending_order', { p_order_id: orderId });
          setOrder(await getOrder(orderId));
          setWaiting(false);
          return;
        }
        attempts += 1;
        if (!next || next.status === 'failed' || next.status === 'cancelled' || attempts >= 15) {
          setWaiting(false);
          return;
        }
        timer = setTimeout(poll, 3000);
      } catch (reason) {
        setError(messageFrom(reason));
        setWaiting(false);
      }
    };
    poll();
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [orderId, outcome]);

  if (waiting && !order) return <LoadingState label="Consultando o pedido no servidor..." />;
  if (error) return <ErrorState message={error} onRetry={() => router.replace('/checkout')} />;

  const paid = order?.status === 'paid';
  return (
    <View style={styles.content}>
      <Text variant="headlineSmall">{paid ? 'Pagamento confirmado' : 'Pagamento ainda não confirmado'}</Text>
      <Text>
        {paid
          ? 'O servidor confirmou a compra. O jogo já pode aparecer na biblioteca.'
          : 'O aplicativo não marca a compra como paga apenas porque o navegador voltou. Aguarde a confirmação do webhook ou atualize esta tela.'}
      </Text>
      {order ? <Text>Status: {order.status} · {formatMoney(order.total_cents, order.currency)}</Text> : <Text>Pedido não encontrado.</Text>}
      {waiting ? <LoadingState label="Aguardando a Stripe confirmar..." /> : null}
      <Button mode="contained" onPress={() => router.replace('/library')}>Abrir biblioteca</Button>
      <Button onPress={() => router.replace('/checkout')}>Ver histórico</Button>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 12 },
});
