import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Chip, Searchbar, Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmptyState, ErrorState, GameCard, LoadingState, Logo, SectionTitle } from '@/components/ui';
import { messageFrom } from '@/lib/supabase';
import { listCategories, listPublishedGames } from '@/services/store';
import type { Category, Game } from '@/types';
import { useFocusEffect } from 'expo-router';

type ListedGame = Game & { category_ids: string[]; developer_name: string | null };

export default function HomeScreen() {
  const [games, setGames] = useState<ListedGame[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([listPublishedGames(), listCategories()])
      .then(([nextGames, nextCategories]) => {
        setGames(nextGames);
        setCategories(nextCategories);
        setError(null);
      })
      .catch((reason) => setError(messageFrom(reason)))
      .finally(() => setLoading(false));
  }, []);

  useFocusEffect(useCallback(() => {
    load();
  }, [load]));

  const featured = games.filter((game) => game.is_featured);
  const newest = [...games].sort((a, b) => (b.published_at ?? '').localeCompare(a.published_at ?? '')).slice(0, 8);
  const bestSellers = [...games].sort((a, b) => b.sales_count - a.sales_count).slice(0, 8);

  return (
    <SafeAreaView style={styles.page} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Logo />
        <Searchbar
          placeholder="Pesquisar jogos"
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={() => router.push({ pathname: '/catalog', params: { q: query } })}
          style={styles.search}
        />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {categories.map((category) => (
            <Chip key={category.id} onPress={() => router.push({ pathname: '/catalog', params: { category: category.id } })}>
              {category.name}
            </Chip>
          ))}
        </ScrollView>
        {loading ? <LoadingState /> : null}
        {error ? <ErrorState message={error} onRetry={load} /> : null}
        {!loading && !error && games.length === 0 ? (
          <EmptyState
            title="Nenhum jogo publicado"
            body="Quando o proprietário publicar um jogo, ele aparece aqui. A loja não usa produtos fictícios."
          />
        ) : null}
        {!loading && !error && featured.length > 0 ? (
          <View>
            <SectionTitle>Em destaque</SectionTitle>
            <View style={styles.grid}>
              {featured.map((game) => (
                <GameCard key={game.id} title={game.title} priceCents={game.price_cents} currency={game.currency} coverPath={game.cover_path} subtitle={[game.developer_name, game.genre].filter(Boolean).join(' · ')} onPress={() => router.push(`/game/${game.id}`)} />
              ))}
            </View>
          </View>
        ) : null}
        {!loading && !error && newest.length > 0 ? (
          <View>
            <SectionTitle>Jogos novos</SectionTitle>
            <View style={styles.grid}>
              {newest.map((game) => (
                <GameCard key={game.id} title={game.title} priceCents={game.price_cents} currency={game.currency} coverPath={game.cover_path} subtitle={`Versão ${game.current_version}`} onPress={() => router.push(`/game/${game.id}`)} />
              ))}
            </View>
          </View>
        ) : null}
        {!loading && !error && bestSellers.length > 0 ? (
          <View>
            <SectionTitle>Mais vendidos</SectionTitle>
            <Text variant="bodySmall" style={styles.note}>{bestSellers[0].sales_count === 0 ? 'Ainda não há vendas confirmadas. A ordem usa o catálogo publicado.' : 'Ordenados pelas compras confirmadas.'}</Text>
            <View style={styles.grid}>
              {bestSellers.map((game) => (
                <GameCard key={game.id} title={game.title} priceCents={game.price_cents} currency={game.currency} coverPath={game.cover_path} subtitle={`${game.sales_count} venda(s)`} onPress={() => router.push(`/game/${game.id}`)} />
              ))}
            </View>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  content: { padding: 16, gap: 8, paddingBottom: 32 },
  search: { marginVertical: 8 },
  chips: { gap: 8, paddingVertical: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  note: { opacity: 0.7, marginBottom: 8 },
});
