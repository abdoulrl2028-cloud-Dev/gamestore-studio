import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { Button, Card, HelperText, Text, TextInput } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmptyState, SectionTitle } from '@/components/ui';
import { formatMoney } from '@/domain/money';
import { useCart } from '@/context/CartContext';
import { messageFrom } from '@/lib/supabase';
import { quoteCoupon } from '@/services/store';

export default function CartScreen() {
  const cart = useCart();
  const [code, setCode] = useState(cart.couponCode);
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const applyCoupon = async () => {
    setLoading(true);
    setError('');
    try {
      const quote = await quoteCoupon(code, cart.summary.subtotalCents);
      if (!quote.valid) {
        cart.clearCoupon();
        setError(quote.message);
        return;
      }
      cart.setCoupon(code, quote.discount_cents);
      setFeedback(quote.discount_cents > 0 ? quote.message : 'Nenhum cupom informado.');
    } catch (reason) {
      setError(messageFrom(reason));
    } finally {
      setLoading(false);
    }
  };

  if (cart.lines.length === 0) {
    return (
      <SafeAreaView style={styles.page} edges={['top']}>
        <EmptyState title="Carrinho vazio" body="Escolha um jogo no catálogo para começar." action={<Button mode="contained" onPress={() => router.push('/catalog')}>Ir ao catálogo</Button>} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.page} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <SectionTitle>Carrinho</SectionTitle>
        {cart.lines.map((line) => (
          <Card key={line.gameId} mode="outlined">
            <Card.Title title={line.title} subtitle={formatMoney(line.priceCents, line.currency)} />
            <Card.Actions>
              <Button onPress={() => cart.remove(line.gameId)}>Remover</Button>
            </Card.Actions>
          </Card>
        ))}
        <TextInput mode="outlined" label="Cupom" value={code} onChangeText={setCode} autoCapitalize="characters" />
        <Button mode="outlined" loading={loading} onPress={applyCoupon}>Aplicar cupom</Button>
        {feedback ? <HelperText type="info">{feedback}</HelperText> : null}
        {error ? <HelperText type="error">{error}</HelperText> : null}
        {cart.summary.mixedCurrency ? <HelperText type="error">Remova jogos de moedas diferentes antes de pagar.</HelperText> : null}
        <Text>Subtotal: {formatMoney(cart.summary.subtotalCents, cart.summary.currency ?? cart.lines[0].currency)}</Text>
        <Text>Descontos: {formatMoney(cart.summary.discountCents, cart.summary.currency ?? cart.lines[0].currency)}</Text>
        <Text variant="titleLarge">Total: {formatMoney(cart.summary.totalCents, cart.summary.currency ?? cart.lines[0].currency)}</Text>
        <Button mode="contained" disabled={cart.summary.mixedCurrency} onPress={() => router.push('/checkout')}>
          Checkout
        </Button>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  content: { padding: 16, gap: 12, paddingBottom: 32 },
});
