import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Chip, SegmentedButtons, Text, TextInput } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';

import { EmptyState, ErrorState, GameCard, LoadingState, SectionTitle } from '@/components/ui';
import { parsePriceToCents } from '@/domain/money';
import { messageFrom } from '@/lib/supabase';
import { listCategories, listPublishedGames } from '@/services/store';
import { PLATFORMS, type Category, type Game, type PlatformName } from '@/types';

type ListedGame = Game & { category_ids: string[]; developer_name: string | null };
type SortKey = 'recent' | 'price-asc' | 'price-desc' | 'rating' | 'sales';

export default function CatalogScreen() {
  const params = useLocalSearchParams<{ q?: string; category?: string }>();
  const [games, setGames] = useState<ListedGame[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [query, setQuery] = useState(params.q ?? '');
  const [categoryId, setCategoryId] = useState(params.category ?? '');
  const [platform, setPlatform] = useState<PlatformName | ''>('');
  const [maxPrice, setMaxPrice] = useState('');
  const [minRating, setMinRating] = useState('0');
  const [sort, setSort] = useState<SortKey>('recent');
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
    if (typeof params.q === 'string') setQuery(params.q);
    if (typeof params.category === 'string') setCategoryId(params.category);
    load();
  }, [load, params.q, params.category]));

  const visible = useMemo(() => {
    const priceCap = maxPrice.trim() ? parsePriceToCents(maxPrice) : null;
    const ratingFloor = Number(minRating) || 0;
    const filtered = games.filter((game) => {
      const matchesQuery = game.title.toLowerCase().includes(query.trim().toLowerCase());
      const matchesCategory = !categoryId || game.category_ids.includes(categoryId);
      const matchesPlatform = !platform || game.platforms.includes(platform);
      const matchesPrice = priceCap === null || game.price_cents <= priceCap;
      const matchesRating = Number(game.average_rating) >= ratingFloor;
      return matchesQuery && matchesCategory && matchesPlatform && matchesPrice && matchesRating;
    });
    return filtered.sort((a, b) => {
      if (sort === 'price-asc') return a.price_cents - b.price_cents;
      if (sort === 'price-desc') return b.price_cents - a.price_cents;
      if (sort === 'rating') return Number(b.average_rating) - Number(a.average_rating);
      if (sort === 'sales') return b.sales_count - a.sales_count;
      return (b.published_at ?? '').localeCompare(a.published_at ?? '');
    });
  }, [games, query, categoryId, platform, maxPrice, minRating, sort]);

  return (
    <SafeAreaView style={styles.page} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <SectionTitle>Catálogo</SectionTitle>
        <TextInput mode="outlined" label="Pesquisar" value={query} onChangeText={setQuery} />
        <Text variant="labelLarge">Categorias</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          <Chip selected={!categoryId} onPress={() => setCategoryId('')}>Todas</Chip>
          {categories.map((category) => (
            <Chip key={category.id} selected={categoryId === category.id} onPress={() => setCategoryId(category.id)}>{category.name}</Chip>
          ))}
        </ScrollView>
        <Text variant="labelLarge">Plataforma</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          <Chip selected={!platform} onPress={() => setPlatform('')}>Todas</Chip>
          {PLATFORMS.map((item) => (
            <Chip key={item.id} selected={platform === item.id} onPress={() => setPlatform(item.id)}>{item.label}</Chip>
          ))}
        </ScrollView>
        <TextInput mode="outlined" label="Preço máximo" value={maxPrice} onChangeText={setMaxPrice} keyboardType="decimal-pad" placeholder="49,90" />
        <Text variant="labelLarge">Avaliação mínima</Text>
        <SegmentedButtons
          value={minRating}
          onValueChange={setMinRating}
          buttons={[
            { value: '0', label: 'Todas' },
            { value: '3', label: '3+' },
            { value: '4', label: '4+' },
          ]}
        />
        <Text variant="labelLarge">Ordenar</Text>
        <SegmentedButtons
          value={sort}
          onValueChange={(value) => setSort(value as SortKey)}
          buttons={[
            { value: 'recent', label: 'Novos' },
            { value: 'price-asc', label: 'Menor preço' },
            { value: 'sales', label: 'Vendidos' },
            { value: 'rating', label: 'Nota' },
          ]}
        />
        {loading ? <LoadingState /> : null}
        {error ? <ErrorState message={error} onRetry={load} /> : null}
        {!loading && !error && visible.length === 0 ? (
          <EmptyState title="Nenhum jogo encontrado" body="Ajuste os filtros ou publique um jogo no painel administrativo." />
        ) : null}
        <View style={styles.grid}>
          {visible.map((game) => (
            <GameCard
              key={game.id}
              title={game.title}
              priceCents={game.price_cents}
              currency={game.currency}
              coverPath={game.cover_path}
              subtitle={[game.developer_name, categories.find((item) => game.category_ids.includes(item.id))?.name ?? game.genre, game.platforms.join(', '), Number(game.average_rating).toFixed(1)].filter(Boolean).join(' · ')}
              onPress={() => router.push(`/game/${game.id}`)}
            />
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  content: { padding: 16, gap: 12, paddingBottom: 32 },
  chips: { gap: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
});
