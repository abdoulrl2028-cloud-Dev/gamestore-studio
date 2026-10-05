import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { Button, Card, HelperText, TextInput } from 'react-native-paper';

import { EmptyState, ErrorState, LoadingState } from '@/components/ui';
import { categorySchema, fieldErrors } from '@/domain/validation';
import { slugify } from '@/domain/versions';
import { messageFrom, requireSupabase } from '@/lib/supabase';
import { listCategories } from '@/services/store';
import type { Category } from '@/types';

export default function CategoriesScreen() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [fieldError, setFieldError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    listCategories()
      .then((next) => {
        setCategories(next);
        setError('');
      })
      .catch((reason) => setError(messageFrom(reason)))
      .finally(() => setLoading(false));
  }, []);

  useFocusEffect(useCallback(() => {
    load();
  }, [load]));

  const create = async () => {
    const parsed = categorySchema.safeParse({ name });
    if (!parsed.success) {
      setFieldError(fieldErrors(parsed.error).name ?? 'Nome inválido.');
      return;
    }
    setFieldError('');
    const { error: insertError } = await requireSupabase().from('categories').insert({ name: parsed.data.name, slug: slugify(parsed.data.name) });
    if (insertError) setError(insertError.message);
    else {
      setName('');
      load();
    }
  };

  const remove = async (category: Category) => {
    const { error: deleteError } = await requireSupabase().from('categories').delete().eq('id', category.id);
    if (deleteError) setError('Não foi possível remover uma categoria que ainda está ligada a um jogo.');
    else load();
  };

  if (loading) return <LoadingState />;
  if (error && categories.length === 0) return <ErrorState message={error} onRetry={load} />;

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <TextInput mode="outlined" label="Nome da categoria" value={name} onChangeText={setName} />
      {fieldError ? <HelperText type="error">{fieldError}</HelperText> : null}
      <Button mode="contained" onPress={create}>Adicionar categoria</Button>
      {error ? <HelperText type="error">{error}</HelperText> : null}
      {categories.length === 0 ? <EmptyState title="Nenhuma categoria" body="Crie categorias como Aventura ou Estratégia para o catálogo." /> : null}
      {categories.map((category) => (
        <Card key={category.id} mode="outlined">
          <Card.Title title={category.name} subtitle={category.slug} />
          <Card.Actions><Button onPress={() => remove(category)}>Remover</Button></Card.Actions>
        </Card>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({ content: { padding: 16, gap: 10 } });
