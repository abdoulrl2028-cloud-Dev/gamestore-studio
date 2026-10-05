import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Button, Chip, HelperText, SegmentedButtons, Switch, Text, TextInput } from 'react-native-paper';

import { ErrorState, LoadingState } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { centsToInput, parsePriceToCents } from '@/domain/money';
import { isAllowedGameFile, isAllowedMediaFile } from '@/domain/files';
import { fieldErrors, gameFormSchema } from '@/domain/validation';
import { slugify } from '@/domain/versions';
import { messageFrom, requireSupabase } from '@/lib/supabase';
import { buildStoragePath, getGame, listCategories, listVersions, uploadToBucket } from '@/services/store';
import { PLATFORMS, type Category, type GameStatus, type GameVersion, type PlatformName } from '@/types';

const emptyForm = {
  title: '',
  shortDescription: '',
  description: '',
  price: '0,00',
  currency: 'brl' as 'brl' | 'usd',
  genre: '',
  platforms: ['android'] as PlatformName[],
  version: '1.0.0',
  minRequirements: '',
  recommendedRequirements: '',
};

export default function GameEditorScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const creating = id === 'new';
  const { profile } = useAuth();
  const [form, setForm] = useState(emptyForm);
  const [status, setStatus] = useState<GameStatus>('draft');
  const [featured, setFeatured] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [versions, setVersions] = useState<GameVersion[]>([]);
  const [versionName, setVersionName] = useState('1.0.0');
  const [changelog, setChangelog] = useState('');
  const [versionPlatform, setVersionPlatform] = useState<PlatformName>('android');
  const [trailerUrl, setTrailerUrl] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(!creating);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    listCategories().then(setCategories).catch((reason) => setError(messageFrom(reason)));
    if (creating || !id) return;
    Promise.all([getGame(id), listVersions(id), requireSupabase().from('game_categories').select('category_id').eq('game_id', id)])
      .then(([game, nextVersions, links]) => {
        if (!game) throw new Error('Jogo não encontrado.');
        if (links.error) throw links.error;
        setForm({
          title: game.title,
          shortDescription: game.short_description,
          description: game.description,
          price: centsToInput(game.price_cents),
          currency: game.currency === 'usd' ? 'usd' : 'brl',
          genre: game.genre,
          platforms: game.platforms,
          version: game.current_version,
          minRequirements: game.min_requirements,
          recommendedRequirements: game.recommended_requirements,
        });
        setStatus(game.status);
        setFeatured(game.is_featured);
        setSelectedCategories((links.data ?? []).map((link) => link.category_id as string));
        setVersions(nextVersions);
        setVersionName(game.current_version);
      })
      .catch((reason) => setError(messageFrom(reason)))
      .finally(() => setLoading(false));
  }, [creating, id]);

  const patch = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));

  const togglePlatform = (platform: PlatformName) => {
    setForm((current) => {
      const exists = current.platforms.includes(platform);
      const platforms = exists ? current.platforms.filter((item) => item !== platform) : [...current.platforms, platform];
      return { ...current, platforms };
    });
  };

  const save = async () => {
    const parsed = gameFormSchema.safeParse(form);
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }
    const price = parsePriceToCents(parsed.data.price);
    if (price === null) return;
    setBusy(true);
    setErrors({});
    setError('');
    try {
      const payload = {
        title: parsed.data.title,
        slug: slugify(parsed.data.title),
        short_description: parsed.data.shortDescription,
        description: parsed.data.description,
        price_cents: price,
        currency: parsed.data.currency,
        genre: parsed.data.genre,
        platforms: parsed.data.platforms,
        current_version: parsed.data.version,
        min_requirements: parsed.data.minRequirements,
        recommended_requirements: parsed.data.recommendedRequirements,
        is_featured: featured,
        ...(status === 'draft' || status === 'published' || status === 'unpublished'
          ? { status, published_at: status === 'published' ? new Date().toISOString() : null }
          : {}),
        created_by: profile?.id ?? null,
      };
      const client = requireSupabase();
      const result = creating
        ? await client.from('games').insert(payload).select('id').single()
        : await client.from('games').update(payload).eq('id', id).select('id').single();
      if (result.error || !result.data) throw result.error ?? new Error('Não foi possível salvar.');
      const gameId = result.data.id as string;
      await client.from('game_categories').delete().eq('game_id', gameId);
      if (selectedCategories.length > 0) {
        const { error: linkError } = await client.from('game_categories').insert(
          selectedCategories.map((categoryId) => ({ game_id: gameId, category_id: categoryId })),
        );
        if (linkError) throw linkError;
      }
      setMessage('Jogo salvo.');
      if (creating) router.replace(`/admin/games/${gameId}`);
    } catch (reason) {
      setError(messageFrom(reason));
    } finally {
      setBusy(false);
    }
  };

  const uploadCover = async () => {
    if (creating || !id) return;
    const picked = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.85 });
    if (picked.canceled) return;
    const asset = picked.assets[0];
    if (!isAllowedMediaFile(asset.fileName ?? 'capa.jpg')) {
      setError('Envie uma imagem PNG, JPG ou WEBP.');
      return;
    }
    setBusy(true);
    try {
      const path = buildStoragePath(id, 'cover', asset.fileName ?? 'capa.jpg');
      await uploadToBucket('game-media', path, asset.uri, asset.mimeType ?? 'image/jpeg');
      const { error: updateError } = await requireSupabase().from('games').update({ cover_path: path }).eq('id', id);
      if (updateError) throw updateError;
      setMessage('Capa enviada.');
    } catch (reason) {
      setError(messageFrom(reason));
    } finally {
      setBusy(false);
    }
  };

  const uploadScreenshot = async () => {
    if (creating || !id) return;
    const picked = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.85, allowsMultipleSelection: true });
    if (picked.canceled) return;
    setBusy(true);
    try {
      for (const [index, asset] of picked.assets.entries()) {
        const path = buildStoragePath(id, 'screenshots', asset.fileName ?? `captura-${index}.jpg`);
        await uploadToBucket('game-media', path, asset.uri, asset.mimeType ?? 'image/jpeg');
        const { error: insertError } = await requireSupabase().from('game_images').insert({
          game_id: id,
          storage_path: path,
          alt_text: form.title,
          sort_order: index,
        });
        if (insertError) throw insertError;
      }
      setMessage('Capturas enviadas.');
    } catch (reason) {
      setError(messageFrom(reason));
    } finally {
      setBusy(false);
    }
  };

  const saveTrailer = async () => {
    if (creating || !id) return;
    if (!/^https:\/\//.test(trailerUrl)) {
      setError('O trailer externo precisa ser um link HTTPS.');
      return;
    }
    setBusy(true);
    try {
      const { error: insertError } = await requireSupabase().from('game_videos').insert({
        game_id: id,
        external_url: trailerUrl,
        title: 'Trailer',
      });
      if (insertError) throw insertError;
      setMessage('Trailer salvo.');
      setTrailerUrl('');
    } catch (reason) {
      setError(messageFrom(reason));
    } finally {
      setBusy(false);
    }
  };

  const uploadTrailerFile = async () => {
    if (creating || !id) return;
    const picked = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true, type: ['video/mp4', 'video/webm'] });
    if (picked.canceled) return;
    const asset = picked.assets[0];
    if (!isAllowedMediaFile(asset.name)) {
      setError('Envie um trailer MP4, WEBM ou MOV.');
      return;
    }
    setBusy(true);
    try {
      const path = buildStoragePath(id, 'trailers', asset.name);
      await uploadToBucket('game-media', path, asset.uri, asset.mimeType ?? 'video/mp4');
      const { error: insertError } = await requireSupabase().from('game_videos').insert({ game_id: id, storage_path: path, title: 'Trailer' });
      if (insertError) throw insertError;
      setMessage('Arquivo de trailer enviado.');
    } catch (reason) {
      setError(messageFrom(reason));
    } finally {
      setBusy(false);
    }
  };

  const publishVersion = async () => {
    if (creating || !id) return;
    const picked = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true, type: '*/*' });
    if (picked.canceled) return;
    const asset = picked.assets[0];
    if (!isAllowedGameFile(asset.name)) {
      setError('Envie APK, AAB, ZIP, EXE ou outro arquivo permitido da lista da loja.');
      return;
    }
    setBusy(true);
    try {
      const path = buildStoragePath(id, versionName, asset.name);
      await uploadToBucket('game-files', path, asset.uri, asset.mimeType ?? 'application/octet-stream');
      const { error: rpcError } = await requireSupabase().rpc('publish_game_version', {
        p_game_id: id,
        p_version_name: versionName,
        p_changelog: changelog,
        p_platform: versionPlatform,
        p_storage_path: path,
        p_file_name: asset.name,
        p_file_size_bytes: asset.size ?? 0,
        p_content_type: asset.mimeType ?? 'application/octet-stream',
      });
      if (rpcError) throw rpcError;
      setVersions(await listVersions(id));
      setMessage('Versão publicada. Quem já comprou pode baixar a mais recente.');
    } catch (reason) {
      setError(messageFrom(reason));
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <LoadingState />;
  if (error && !form.title && !creating) return <ErrorState message={error} onRetry={() => router.replace('/admin/games')} />;

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text variant="titleLarge">{creating ? 'Adicionar jogo' : 'Editar jogo'}</Text>
      <TextInput mode="outlined" label="Nome" value={form.title} onChangeText={(value) => patch('title', value)} error={Boolean(errors.title)} />
      {errors.title ? <HelperText type="error">{errors.title}</HelperText> : null}
      <TextInput mode="outlined" label="Descrição curta" value={form.shortDescription} onChangeText={(value) => patch('shortDescription', value)} error={Boolean(errors.shortDescription)} />
      {errors.shortDescription ? <HelperText type="error">{errors.shortDescription}</HelperText> : null}
      <TextInput mode="outlined" label="Descrição" value={form.description} onChangeText={(value) => patch('description', value)} multiline error={Boolean(errors.description)} />
      {errors.description ? <HelperText type="error">{errors.description}</HelperText> : null}
      <TextInput mode="outlined" label="Preço" value={form.price} onChangeText={(value) => patch('price', value)} keyboardType="decimal-pad" error={Boolean(errors.price)} />
      {errors.price ? <HelperText type="error">{errors.price}</HelperText> : null}
      <SegmentedButtons value={form.currency} onValueChange={(value) => patch('currency', value)} buttons={[{ value: 'brl', label: 'BRL' }, { value: 'usd', label: 'USD' }]} />
      <TextInput mode="outlined" label="Gênero" value={form.genre} onChangeText={(value) => patch('genre', value)} />
      <TextInput mode="outlined" label="Versão exibida" value={form.version} onChangeText={(value) => patch('version', value)} />
      <Text>Plataformas</Text>
      <View style={styles.row}>
        {PLATFORMS.map((platform) => (
          <Chip key={platform.id} selected={form.platforms.includes(platform.id)} onPress={() => togglePlatform(platform.id)}>{platform.label}</Chip>
        ))}
      </View>
      {errors.platforms ? <HelperText type="error">{errors.platforms}</HelperText> : null}
      <TextInput mode="outlined" label="Requisitos mínimos" value={form.minRequirements} onChangeText={(value) => patch('minRequirements', value)} multiline />
      <TextInput mode="outlined" label="Requisitos recomendados" value={form.recommendedRequirements} onChangeText={(value) => patch('recommendedRequirements', value)} multiline />
      <Text>Categorias</Text>
      <View style={styles.row}>
        {categories.map((category) => (
          <Chip
            key={category.id}
            selected={selectedCategories.includes(category.id)}
            onPress={() => setSelectedCategories((current) => current.includes(category.id) ? current.filter((item) => item !== category.id) : [...current, category.id])}
          >
            {category.name}
          </Chip>
        ))}
      </View>
      <View style={styles.switch}><Text>Destaque na página inicial</Text><Switch value={featured} onValueChange={setFeatured} /></View>
      {status === 'draft' || status === 'published' || status === 'unpublished' ? (
        <SegmentedButtons
          value={status}
          onValueChange={(value) => setStatus(value as GameStatus)}
          buttons={[
            { value: 'draft', label: 'Rascunho' },
            { value: 'published', label: 'Publicado' },
            { value: 'unpublished', label: 'Oculto' },
          ]}
        />
      ) : (
        <HelperText type="info">Este jogo está em {status}. Aprove ou rejeite em Jogos pendentes para não interromper a análise.</HelperText>
      )}
      <Button mode="contained" loading={busy} onPress={save}>Salvar jogo e preço</Button>
      {creating ? <HelperText type="info">Salve o jogo antes de enviar capa, capturas, trailer ou arquivos.</HelperText> : null}
      <Button mode="outlined" disabled={creating || busy} onPress={uploadCover}>Enviar capa</Button>
      <Button mode="outlined" disabled={creating || busy} onPress={uploadScreenshot}>Enviar capturas</Button>
      <TextInput mode="outlined" label="Link HTTPS do trailer" value={trailerUrl} onChangeText={setTrailerUrl} autoCapitalize="none" />
      <Button mode="outlined" disabled={creating || busy} onPress={saveTrailer}>Salvar link do trailer</Button>
      <Button mode="outlined" disabled={creating || busy} onPress={uploadTrailerFile}>Enviar arquivo de trailer</Button>
      <Text variant="titleMedium">Nova versão</Text>
      <TextInput mode="outlined" label="Versão do arquivo" value={versionName} onChangeText={setVersionName} />
      <TextInput mode="outlined" label="Notas da versão" value={changelog} onChangeText={setChangelog} multiline />
      <View style={styles.row}>
        {PLATFORMS.map((platform) => (
          <Chip key={platform.id} selected={versionPlatform === platform.id} onPress={() => setVersionPlatform(platform.id)}>{platform.label}</Chip>
        ))}
      </View>
      <Button mode="contained" disabled={creating || busy} onPress={publishVersion}>Publicar arquivo da versão</Button>
      {versions.map((version) => (
        <Text key={version.id}>{version.version_name} · {version.platform} · {version.file_name}{version.is_latest ? ' · atual' : ''}</Text>
      ))}
      {message ? <HelperText type="info">{message}</HelperText> : null}
      {error ? <HelperText type="error">{error}</HelperText> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 8, paddingBottom: 40 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  switch: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});
