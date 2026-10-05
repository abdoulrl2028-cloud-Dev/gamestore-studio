import * as Crypto from 'expo-crypto';
import { router, useFocusEffect } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { Button, HelperText, SegmentedButtons, Text } from 'react-native-paper';

import { EmptyState } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { useCart } from '@/context/CartContext';
import { formatMoney } from '@/domain/money';
import { messageFrom } from '@/lib/supabase';
import { getGame, listOrders, startCheckout } from '@/services/store';
import type { OrderRow } from '@/types';

export default function CheckoutScreen() {
  const { session } = useAuth();
  const cart = useCart();
  const [method, setMethod] = useState<'card' | 'pix'>('card');
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useFocusEffect(useCallback(() => {
    if (!session) return;
    listOrders().then(setOrders).catch((reason) => setError(messageFrom(reason)));
  }, [session?.user?.id]));

  if (!session) {
    return <EmptyState title="Entre para pagar" body="A compra fica vinculada à sua conta." action={<Button mode="contained" onPress={() => router.push('/auth/login')}>Entrar</Button>} />;
  }

  const currency = cart.summary.currency ?? 'brl';
  const pixAllowed = currency === 'brl' && !cart.summary.mixedCurrency;

  const pay = async () => {
    if (cart.lines.length === 0) {
      setError('Seu carrinho está vazio.');
      return;
    }
    if (cart.summary.mixedCurrency) {
      setError('Não é possível misturar moedas no mesmo pedido.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const fresh = await Promise.all(cart.lines.map((line) => getGame(line.gameId)));
      if (fresh.some((game) => !game || game.status !== 'published')) {
        throw new Error('Um jogo do carrinho não está mais publicado.');
      }
      const result = await startCheckout({
        gameIds: cart.lines.map((line) => line.gameId),
        idempotencyKey: Crypto.randomUUID(),
        couponCode: cart.couponCode,
        paymentMethod: method === 'pix' && pixAllowed ? 'pix' : 'card',
      });
      if (result.status === 'paid') {
        cart.clear();
        router.replace({ pathname: '/checkout/result', params: { order_id: result.orderId } });
        return;
      }
      if (!result.url) throw new Error('O servidor não retornou o pagamento.');
      await WebBrowser.openAuthSessionAsync(result.url, 'gamestorestudio://checkout/result');
      router.replace({ pathname: '/checkout/result', params: { order_id: result.orderId } });
    } catch (reason) {
      setError(messageFrom(reason));
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text variant="headlineSmall">Checkout</Text>
      {cart.lines.length === 0 ? <Text>Nenhum item selecionado agora.</Text> : cart.lines.map((line) => (
        <Text key={line.gameId}>{line.title} — {formatMoney(line.priceCents, line.currency)}</Text>
      ))}
      <Text>Subtotal: {formatMoney(cart.summary.subtotalCents, currency)}</Text>
      <Text>Descontos: {formatMoney(cart.summary.discountCents, currency)}</Text>
      <Text variant="titleLarge">Total: {formatMoney(cart.summary.totalCents, currency)}</Text>
      <Text variant="titleMedium">Método de pagamento</Text>
      <SegmentedButtons
        value={method}
        onValueChange={(value) => setMethod(value as 'card' | 'pix')}
        buttons={[
          { value: 'card', label: 'Cartão' },
          { value: 'pix', label: 'PIX', disabled: !pixAllowed },
        ]}
      />
      <HelperText type="info">O PIX aparece quando todos os itens estão em BRL e a conta Stripe está habilitada para PIX. A confirmação vem do servidor.</HelperText>
      {error ? <HelperText type="error">{error}</HelperText> : null}
      <Button mode="contained" loading={loading} disabled={cart.lines.length === 0} onPress={pay}>Confirmar compra</Button>
      <Text variant="titleMedium">Histórico de compras</Text>
      {orders.length === 0 ? <Text>Nenhuma compra registrada.</Text> : orders.map((order) => (
        <Text key={order.id}>{new Date(order.created_at).toLocaleDateString('pt-BR')} · {order.status} · {formatMoney(order.total_cents, order.currency)} · {(order.order_items ?? []).map((item) => item.games?.title).filter(Boolean).join(', ')}</Text>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 10, paddingBottom: 32 },
});
