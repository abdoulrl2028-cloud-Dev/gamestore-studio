import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';
import { Button, Chip, HelperText, SegmentedButtons, Text, TextInput } from 'react-native-paper';

import { ErrorState, LoadingState } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { isAllowedGameFile, isAllowedMediaFile } from '@/domain/files';
import { centsToInput, parsePriceToCents } from '@/domain/money';
import { AGE_RATINGS, GAME_STATUS_LABEL } from '@/domain/submission';
import { developerGameSchema, fieldErrors } from '@/domain/validation';
import { slugify } from '@/domain/versions';
import { messageFrom, requireSupabase } from '@/lib/supabase';
import { attachOwnFile, becomeDeveloper, buildStoragePath, getGame, listCategories, listVersions, submitOwnGame } from '@/services/store';
import { assertUploadSize, startUpload, type UploadHandle, type UploadProgress } from '@/services/uploads';
import { PLATFORMS, type Category, type GameVersion, type PlatformName } from '@/types';

const emptyForm = {
  title: '',
  shortDescription: '',
  description: '',
  price: '0,00',
  currency: 'brl' as 'brl' | 'usd',
  genre: '',
  platforms: ['windows'] as PlatformName[],
  version: '1.0.0',
  minRequirements: '',
  recommendedRequirements: '',
  ageRating: 'L' as (typeof AGE_RATINGS)[number],
  categoryId: '',
  privacyPolicyUrl: '',
  developerWebsite: '',
};

type LocalFile = { uri: string; name: string; mimeType: string; size?: number; file?: Blob };

export default function PublishGameScreen() {
  const { id, focus } = useLocalSearchParams<{ id: string; focus?: string }>();
  const creating = id === 'new';
  const { profile, refreshProfile } = useAuth();
  const [form, setForm] = useState(emptyForm);
  const [categories, setCategories] = useState<Category[]>([]);
  const [versions, setVersions] = useState<GameVersion[]>([]);
  const [trailerUrl, setTrailerUrl] = useState('');
  const [versionPlatform, setVersionPlatform] = useState<PlatformName>('windows');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(!creating);
  const [busy, setBusy] = useState(false);
  const [upload, setUpload] = useState<(UploadProgress & { status: string }) | null>(null);
  const uploadRef = useRef<UploadHandle | null>(null);

  useEffect(() => {
    listCategories().then(setCategories).catch((reason) => setError(messageFrom(reason)));
    if (creating || !id) return;
    Promise.all([
      getGame(id),
      listVersions(id),
      requireSupabase().from('game_categories').select('category_id').eq('game_id', id),
    ])
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
          ageRating: (AGE_RATINGS as readonly string[]).includes(game.age_rating) ? game.age_rating as (typeof AGE_RATINGS)[number] : 'L',
          categoryId: (links.data?.[0]?.category_id as string | undefined) ?? '',
          privacyPolicyUrl: game.privacy_policy_url ?? '',
          developerWebsite: game.developer_website ?? '',
        });
        setVersions(nextVersions);
        setVersionPlatform(game.platforms[0] ?? 'windows');
        setMessage(game.status === 'rejected' ? `Seu jogo foi rejeitado. Consulte o motivo. ${game.review_note}` : GAME_STATUS_LABEL[game.status]);
      })
      .catch((reason) => setError(messageFrom(reason)))
      .finally(() => setLoading(false));
  }, [creating, id]);

  const patch = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));

  const togglePlatform = (platform: PlatformName) => {
    setForm((current) => {
      const exists = current.platforms.includes(platform);
      const platforms = exists ? current.platforms.filter((item) => item !== platform) : [...current.platforms, platform];
      return { ...current, platforms: platforms.length > 0 ? platforms : current.platforms };
    });
  };

  const ensureDeveloper = async () => {
    if (!profile) throw new Error('Faça login para publicar um jogo.');
    if (profile.role === 'user') {
      await becomeDeveloper();
      await refreshProfile();
    }
  };

  const save = async () => {
    const parsed = developerGameSchema.safeParse(form);
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      setError('Preencha os campos obrigatórios antes de continuar.');
      return null;
    }
    const price = parsePriceToCents(parsed.data.price);
    if (price === null) return null;
    setBusy(true);
    setErrors({});
    setError('');
    try {
      await ensureDeveloper();
      const payload = {
        title: parsed.data.title,
        slug: `${slugify(parsed.data.title)}-${Date.now().toString(36)}`,
        short_description: parsed.data.shortDescription,
        description: parsed.data.description,
        price_cents: price,
        currency: parsed.data.currency,
        genre: parsed.data.genre,
        platforms: parsed.data.platforms,
        current_version: parsed.data.version,
        min_requirements: parsed.data.minRequirements,
        recommended_requirements: parsed.data.recommendedRequirements,
        age_rating: parsed.data.ageRating,
        privacy_policy_url: parsed.data.privacyPolicyUrl,
        developer_website: parsed.data.developerWebsite || null,
        owner_id: profile?.id ?? null,
        status: 'draft' as const,
      };
      const client = requireSupabase();
      const result = creating
        ? await client.from('games').insert(payload).select('id').single()
        : await client.from('games').update({
          title: payload.title,
          short_description: payload.short_description,
          description: payload.description,
          price_cents: payload.price_cents,
          currency: payload.currency,
          genre: payload.genre,
          platforms: payload.platforms,
          current_version: payload.current_version,
          min_requirements: payload.min_requirements,
          recommended_requirements: payload.recommended_requirements,
          age_rating: payload.age_rating,
          privacy_policy_url: payload.privacy_policy_url,
          developer_website: payload.developer_website,
        }).eq('id', id).select('id').single();
      if (result.error || !result.data) throw result.error ?? new Error('Não foi possível salvar.');
      const gameId = result.data.id as string;
      await client.from('game_categories').delete().eq('game_id', gameId);
      const { error: linkError } = await client.from('game_categories').insert({ game_id: gameId, category_id: parsed.data.categoryId });
      if (linkError) throw linkError;
      setMessage('Rascunho salvo.');
      if (creating) router.replace(`/studio/${gameId}`);
      return gameId;
    } catch (reason) {
      setError(messageFrom(reason));
      return null;
    } finally {
      setBusy(false);
    }
  };

  const sendFile = async (bucket: 'game-media' | 'game-files', path: string, asset: LocalFile) => {
    assertUploadSize(asset.size);
    setUpload({ loaded: 0, total: asset.size ?? 0, fraction: 0, bytesPerSecond: 0, label: 'Preparando envio...', status: 'Enviando' });
    const handle = startUpload({
      bucket,
      path,
      uri: asset.uri,
      file: asset.file,
      contentType: asset.mimeType,
      size: asset.size,
      onProgress: (progress) => setUpload({ ...progress, status: 'Enviando' }),
    });
    uploadRef.current = handle;
    try {
      await handle.promise;
      setUpload((current) => current ? { ...current, status: 'Concluído', fraction: 1 } : current);
    } catch (reason) {
      setUpload((current) => current ? { ...current, status: 'Erro' } : current);
      throw reason;
    } finally {
      uploadRef.current = null;
    }
  };

  const uploadCover = async () => {
    if (creating || !id) return;
    const picked = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.85 });
    if (picked.canceled) return;
    const asset = picked.assets[0];
    const name = asset.fileName ?? 'capa.jpg';
    if (!isAllowedMediaFile(name)) {
      setError('Envie uma imagem PNG, JPG ou WEBP.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const path = buildStoragePath(id, 'cover', name);
      await sendFile('game-media', path, {
        uri: asset.uri,
        name,
        mimeType: asset.mimeType ?? 'image/jpeg',
        size: asset.fileSize,
        file: asset.file,
      });
      const { error: updateError } = await requireSupabase().from('games').update({ cover_path: path }).eq('id', id);
      if (updateError) throw updateError;
      setMessage('Capa enviada.');
    } catch (reason) {
      setError(messageFrom(reason));
    } finally {
      setBusy(false);
    }
  };

  const uploadScreenshots = async () => {
    if (creating || !id) return;
    const picked = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.85, allowsMultipleSelection: true });
    if (picked.canceled) return;
    setBusy(true);
    setError('');
    try {
      for (const [index, asset] of picked.assets.entries()) {
        const name = asset.fileName ?? `captura-${index}.jpg`;
        if (!isAllowedMediaFile(name)) throw new Error('Envie imagens PNG, JPG ou WEBP.');
        const path = buildStoragePath(id, 'screenshots', name);
        await sendFile('game-media', path, {
          uri: asset.uri,
          name,
          mimeType: asset.mimeType ?? 'image/jpeg',
          size: asset.fileSize,
          file: asset.file,
        });
        const { error: insertError } = await requireSupabase().from('game_images').insert({
          game_id: id,
          storage_path: path,
          alt_text: form.title,
          sort_order: versions.length + index,
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
      setError('O trailer precisa ser um link https.');
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

  const uploadGameFile = async () => {
    if (creating || !id) return;
    const picked = await DocumentPicker.getDocumentAsync({
      copyToCacheDirectory: Platform.OS !== 'web',
      type: '*/*',
    });
    if (picked.canceled) return;
    const asset = picked.assets[0];
    if (!isAllowedGameFile(asset.name)) {
      setError('Formato de arquivo não permitido. Use ZIP, RAR, 7Z ou um instalador da lista da loja.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const path = buildStoragePath(id, form.version, asset.name);
      await sendFile('game-files', path, {
        uri: asset.uri,
        name: asset.name,
        mimeType: asset.mimeType ?? 'application/octet-stream',
        size: asset.size,
        file: asset.file,
      });
      await attachOwnFile({
        gameId: id,
        versionName: form.version,
        platform: versionPlatform,
        storagePath: path,
        fileName: asset.name,
        fileSizeBytes: asset.size ?? 0,
        contentType: asset.mimeType ?? 'application/octet-stream',
      });
      setVersions(await listVersions(id));
      setMessage('Arquivo da versão enviado.');
    } catch (reason) {
      setError(messageFrom(reason));
    } finally {
      setBusy(false);
    }
  };

  const submit = async () => {
    const gameId = creating ? await save() : id;
    if (!gameId) return;
    setBusy(true);
    try {
      await submitOwnGame(gameId);
      setMessage('Seu jogo foi enviado para análise.');
    } catch (reason) {
      setError(messageFrom(reason));
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <LoadingState />;
  if (error && !form.title && !creating) return <ErrorState message={error} onRetry={() => router.replace('/studio')} />;

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text variant="titleLarge">{creating ? 'Publicar novo jogo' : 'Editar jogo'}</Text>
      {focus === 'version' ? <HelperText type="info">Informe a nova versão, como 1.1.0, e envie o arquivo dela.</HelperText> : null}
      <TextInput mode="outlined" label="Nome do jogo" value={form.title} onChangeText={(value) => patch('title', value)} error={Boolean(errors.title)} />
      {errors.title ? <HelperText type="error">{errors.title}</HelperText> : null}
      <TextInput mode="outlined" label="Descrição curta" value={form.shortDescription} onChangeText={(value) => patch('shortDescription', value)} error={Boolean(errors.shortDescription)} />
      {errors.shortDescription ? <HelperText type="error">{errors.shortDescription}</HelperText> : null}
      <TextInput mode="outlined" label="Descrição" value={form.description} onChangeText={(value) => patch('description', value)} multiline error={Boolean(errors.description)} />
      {errors.description ? <HelperText type="error">{errors.description}</HelperText> : null}
      <Text>Categoria</Text>
      <View style={styles.row}>
        {categories.map((category) => (
          <Chip key={category.id} selected={form.categoryId === category.id} onPress={() => patch('categoryId', category.id)}>{category.name}</Chip>
        ))}
      </View>
      {errors.categoryId ? <HelperText type="error">{errors.categoryId}</HelperText> : null}
      <TextInput mode="outlined" label="Gênero" value={form.genre} onChangeText={(value) => patch('genre', value)} error={Boolean(errors.genre)} />
      <Text>Plataforma</Text>
      <View style={styles.row}>
        {PLATFORMS.map((platform) => (
          <Chip key={platform.id} selected={form.platforms.includes(platform.id)} onPress={() => togglePlatform(platform.id)}>{platform.label}</Chip>
        ))}
      </View>
      {errors.platforms ? <HelperText type="error">{errors.platforms}</HelperText> : null}
      <TextInput mode="outlined" label="Preço" value={form.price} onChangeText={(value) => patch('price', value)} keyboardType="decimal-pad" error={Boolean(errors.price)} />
      {errors.price ? <HelperText type="error">{errors.price}</HelperText> : null}
      <SegmentedButtons value={form.currency} onValueChange={(value) => patch('currency', value)} buttons={[{ value: 'brl', label: 'BRL' }, { value: 'usd', label: 'USD' }]} />
      <TextInput mode="outlined" label="Versão" value={form.version} onChangeText={(value) => patch('version', value)} error={Boolean(errors.version)} />
      {errors.version ? <HelperText type="error">{errors.version}</HelperText> : null}
      <Text>Classificação indicativa</Text>
      <View style={styles.row}>
        {AGE_RATINGS.map((rating) => (
          <Chip key={rating} selected={form.ageRating === rating} onPress={() => patch('ageRating', rating)}>{rating}</Chip>
        ))}
      </View>
      <TextInput mode="outlined" label="Requisitos mínimos" value={form.minRequirements} onChangeText={(value) => patch('minRequirements', value)} multiline error={Boolean(errors.minRequirements)} />
      <TextInput mode="outlined" label="Requisitos recomendados" value={form.recommendedRequirements} onChangeText={(value) => patch('recommendedRequirements', value)} multiline />
      <TextInput mode="outlined" label="Site do desenvolvedor" value={form.developerWebsite} onChangeText={(value) => patch('developerWebsite', value)} autoCapitalize="none" />
      {errors.developerWebsite ? <HelperText type="error">{errors.developerWebsite}</HelperText> : null}
      <TextInput mode="outlined" label="Política de privacidade" value={form.privacyPolicyUrl} onChangeText={(value) => patch('privacyPolicyUrl', value)} autoCapitalize="none" error={Boolean(errors.privacyPolicyUrl)} />
      {errors.privacyPolicyUrl ? <HelperText type="error">{errors.privacyPolicyUrl}</HelperText> : null}
      <Button mode="contained" loading={busy && !upload} onPress={save}>Salvar rascunho</Button>
      {creating ? <HelperText type="info">Salve o rascunho antes de enviar capa, capturas e o arquivo do jogo.</HelperText> : null}
      <Button mode="outlined" disabled={creating || busy} onPress={uploadCover}>Enviar capa</Button>
      <Button mode="outlined" disabled={creating || busy} onPress={uploadScreenshots}>Enviar screenshots</Button>
      <TextInput mode="outlined" label="Trailer (link https)" value={trailerUrl} onChangeText={setTrailerUrl} autoCapitalize="none" />
      <Button mode="outlined" disabled={creating || busy} onPress={saveTrailer}>Salvar trailer</Button>
      <Text>Arquivo desta versão</Text>
      <View style={styles.row}>
        {PLATFORMS.map((platform) => (
          <Chip key={platform.id} selected={versionPlatform === platform.id} onPress={() => setVersionPlatform(platform.id)}>{platform.label}</Chip>
        ))}
      </View>
      <Button mode="contained" disabled={creating || busy} onPress={uploadGameFile}>Enviar arquivo do jogo</Button>
      {upload ? (
        <View style={styles.block}>
          <Text>Status: {upload.status}</Text>
          <Text>{upload.label}</Text>
          <Text>{Math.round(upload.fraction * 100)}%</Text>
          {upload.status === 'Enviando' ? <Button mode="outlined" onPress={() => uploadRef.current?.cancel()}>Cancelar envio</Button> : null}
        </View>
      ) : null}
      {versions.map((version) => (
        <Text key={version.id}>{version.version_name} · {version.platform} · {version.file_name}{version.is_latest ? ' · atual' : ''}</Text>
      ))}
      <Button mode="contained" disabled={busy} onPress={submit}>Enviar para análise</Button>
      {message ? <HelperText type="info">{message}</HelperText> : null}
      {error ? <HelperText type="error">{error}</HelperText> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 8, paddingBottom: 48 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  block: { gap: 4 },
});
