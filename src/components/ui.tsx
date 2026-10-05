import { Image } from 'expo-image';
import { type ReactNode } from 'react';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { ActivityIndicator, Button, Card, Text } from 'react-native-paper';

import { formatMoney } from '@/domain/money';
import { mediaUrl } from '@/lib/media';

export function LoadingState({ label = 'Carregando...' }: { label?: string }) {
  return (
    <View style={styles.center}>
      <ActivityIndicator />
      <Text variant="bodyMedium" style={styles.muted}>{label}</Text>
    </View>
  );
}

export function EmptyState({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <View style={styles.center}>
      <Text variant="titleMedium">{title}</Text>
      <Text variant="bodyMedium" style={[styles.muted, styles.body]}>{body}</Text>
      {action}
    </View>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <View style={styles.center}>
      <Text variant="titleMedium">Não foi possível continuar</Text>
      <Text variant="bodyMedium" style={[styles.muted, styles.body]}>{message}</Text>
      {onRetry ? <Button mode="contained" onPress={onRetry}>Tentar novamente</Button> : null}
    </View>
  );
}

export function Logo() {
  return (
    <View style={styles.logoRow}>
      <View style={styles.mark}><Text style={styles.markText}>GS</Text></View>
      <View>
        <Text variant="titleLarge" style={styles.brand}>GameStore Studio</Text>
        <Text variant="bodySmall" style={styles.muted}>Seus jogos, sua loja</Text>
      </View>
    </View>
  );
}

export function GameCard({
  title,
  priceCents,
  currency,
  coverPath,
  subtitle,
  onPress,
}: {
  title: string;
  priceCents: number;
  currency: string;
  coverPath: string | null;
  subtitle?: string;
  onPress: () => void;
}) {
  const { width } = useWindowDimensions();
  const cardWidth = width >= 900 ? (width - 64) / 3 : width >= 640 ? (width - 48) / 2 : width - 32;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={title} onPress={onPress} style={{ width: cardWidth }}>
      <Card mode="elevated">
        <Image source={mediaUrl(coverPath) ? { uri: mediaUrl(coverPath)! } : undefined} style={styles.cover} contentFit="cover" />
        <Card.Title title={title} subtitle={subtitle} titleNumberOfLines={2} />
        <Card.Content>
          <Text variant="titleMedium">{formatMoney(priceCents, currency)}</Text>
        </Card.Content>
      </Card>
    </Pressable>
  );
}

export function SectionTitle({ children }: { children: string }) {
  return <Text variant="titleLarge" style={styles.section}>{children}</Text>;
}

const styles = StyleSheet.create({
  center: { padding: 24, alignItems: 'center', justifyContent: 'center', gap: 12 },
  muted: { opacity: 0.75, textAlign: 'center' },
  body: { maxWidth: 420 },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  mark: { width: 52, height: 52, borderRadius: 16, backgroundColor: '#4C35C5', alignItems: 'center', justifyContent: 'center' },
  markText: { color: '#FFFFFF', fontWeight: '800', fontSize: 18 },
  brand: { fontWeight: '800' },
  cover: { width: '100%', height: 180, backgroundColor: '#241F3D' },
  section: { marginTop: 8, marginBottom: 12, fontWeight: '700' },
});
