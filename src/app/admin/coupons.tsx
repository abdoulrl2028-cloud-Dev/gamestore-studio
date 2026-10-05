import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { Button, Card, HelperText, SegmentedButtons, Text, TextInput } from 'react-native-paper';

import { EmptyState, ErrorState, LoadingState } from '@/components/ui';
import { couponSchema, fieldErrors } from '@/domain/validation';
import { messageFrom, requireSupabase } from '@/lib/supabase';

type Coupon = {
  id: string;
  code: string;
  discount_type: 'percent' | 'fixed';
  discount_value: number;
  active: boolean;
  max_redemptions: number | null;
  redeemed_count: number;
};

export default function CouponsScreen() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [code, setCode] = useState('');
  const [discountType, setDiscountType] = useState<'percent' | 'fixed'>('percent');
  const [discountValue, setDiscountValue] = useState('10');
  const [maxRedemptions, setMaxRedemptions] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    void (async () => {
      try {
        const { data, error: queryError } = await requireSupabase()
          .from('coupons')
          .select('id, code, discount_type, discount_value, active, max_redemptions, redeemed_count')
          .order('created_at', { ascending: false });
        if (queryError) throw queryError;
        setCoupons((data ?? []) as Coupon[]);
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

  const create = async () => {
    const parsed = couponSchema.safeParse({
      code,
      discountType,
      discountValue: Number(discountValue),
      maxRedemptions: maxRedemptions.trim() ? Number(maxRedemptions) : null,
    });
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }
    setErrors({});
    const { error: insertError } = await requireSupabase().from('coupons').insert({
      code: parsed.data.code.toUpperCase(),
      discount_type: parsed.data.discountType,
      discount_value: parsed.data.discountValue,
      max_redemptions: parsed.data.maxRedemptions,
    });
    if (insertError) setError(insertError.message);
    else {
      setCode('');
      load();
    }
  };

  const toggle = async (coupon: Coupon) => {
    const { error: updateError } = await requireSupabase().from('coupons').update({ active: !coupon.active }).eq('id', coupon.id);
    if (updateError) setError(updateError.message);
    else load();
  };

  if (loading) return <LoadingState />;
  if (error && coupons.length === 0) return <ErrorState message={error} onRetry={load} />;

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <TextInput mode="outlined" label="Código" value={code} onChangeText={setCode} autoCapitalize="characters" />
      {errors.code ? <HelperText type="error">{errors.code}</HelperText> : null}
      <SegmentedButtons value={discountType} onValueChange={(value) => setDiscountType(value as 'percent' | 'fixed')} buttons={[{ value: 'percent', label: 'Porcentagem' }, { value: 'fixed', label: 'Valor em centavos' }]} />
      <TextInput mode="outlined" label={discountType === 'percent' ? 'Porcentagem' : 'Centavos'} value={discountValue} onChangeText={setDiscountValue} keyboardType="number-pad" />
      {errors.discountValue ? <HelperText type="error">{errors.discountValue}</HelperText> : null}
      <TextInput mode="outlined" label="Máximo de usos (opcional)" value={maxRedemptions} onChangeText={setMaxRedemptions} keyboardType="number-pad" />
      <Button mode="contained" onPress={create}>Criar cupom</Button>
      {error ? <HelperText type="error">{error}</HelperText> : null}
      {coupons.length === 0 ? <EmptyState title="Nenhum cupom" body="Crie um cupom para oferecer desconto no checkout." /> : null}
      {coupons.map((coupon) => (
        <Card key={coupon.id} mode="outlined">
          <Card.Title title={coupon.code} subtitle={`${coupon.discount_type} ${coupon.discount_value} · ${coupon.redeemed_count} usos · ${coupon.active ? 'ativo' : 'inativo'}`} />
          <Card.Actions><Button onPress={() => toggle(coupon)}>{coupon.active ? 'Desativar' : 'Ativar'}</Button></Card.Actions>
        </Card>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({ content: { padding: 16, gap: 10 } });
