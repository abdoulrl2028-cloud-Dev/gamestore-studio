import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useCallback, useState } from 'react';
import { Linking, ScrollView, StyleSheet, View } from 'react-native';
import { Button, Card, Chip, HelperText, Text, TextInput } from 'react-native-paper';

import { EmptyState, ErrorState, LoadingState } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { useCart } from '@/context/CartContext';
import { formatBytes, isDirectVideo } from '@/domain/files';
import { formatMoney } from '@/domain/money';
import { fieldErrors, reviewSchema } from '@/domain/validation';
import { mediaUrl } from '@/lib/media';
import { messageFrom, requireSupabase } from '@/lib/supabase';
import { downloadGame } from '@/services/downloads';
import { developerName, getGame, getGameMedia, listReviews, listVersions, userOwnsGame } from '@/services/store';
import type { Game, GameImage, GameVersion, GameVideo, PlatformName, Review } from '@/types';
import { useFocusEffect } from 'expo-router';

function Trailer({ url }: { url: string }) {
  const player = useVideoPlayer(url, (instance) => {
    instance.loop = false;
  });
  return <VideoView player={player} style={styles.video} nativeControls contentFit="contain" />;
}

export default function GameScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const cart = useCart();
  const [game, setGame] = useState<Game | null>(null);
  const [images, setImages] = useState<GameImage[]>([]);
  const [videos, setVideos] = useState<GameVideo[]>([]);
  const [versions, setVersions] = useState<GameVersion[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [owned, setOwned] = useState(false);
  const [developer, setDeveloper] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rating, setRating] = useState('5');
  const [body, setBody] = useState('');
  const [reviewError, setReviewError] = useState('');
  const [downloadMessage, setDownloadMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    if (!id) return;
    setLoading(true);
    Promise.all([getGame(id), getGameMedia(id), listVersions(id), listReviews(id), developerName(id)])
      .then(async ([nextGame, media, nextVersions, nextReviews, ownerName]) => {
        setGame(nextGame);
        setImages(media.images);
        setVideos(media.videos);
        setVersions(nextVersions);
        setReviews(nextReviews);
        setDeveloper(ownerName);
        setOwned(session?.user ? await userOwnsGame(id, session.user.id) : false);
        setError(null);
      })
      .catch((reason) => setError(messageFrom(reason)))
      .finally(() => setLoading(false));
  }, [id, session?.user?.id]);

  useFocusEffect(useCallback(() => {
    load();
  }, [load]));

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!game) return <EmptyState title="Jogo não encontrado" body="Ele pode ter sido removido ou ainda não foi publicado." />;

  const trailer = videos[0];
  const trailerUrl = trailer?.external_url || mediaUrl(trailer?.storage_path);
  const latest = versions.find((version) => version.is_latest);

  const buy = () => {
    cart.add({
      gameId: game.id,
      title: game.title,
      priceCents: game.price_cents,
      currency: game.currency,
      coverPath: game.cover_path,
    });
    router.push('/cart');
  };

  const download = async (platform: PlatformName) => {
    setBusy(true);
    setDownloadMessage('');
    try {
      const saved = await downloadGame(game.id, platform, (fraction) => {
        setDownloadMessage(`Baixando ${Math.round(fraction * 100)}%`);
      });
      setDownloadMessage(`Versão ${saved.versionName} pronta: ${saved.fileName}`);
    } catch (reason) {
      setDownloadMessage(messageFrom(reason));
    } finally {
      setBusy(false);
    }
  };

  const sendReview = async () => {
    const parsed = reviewSchema.safeParse({ rating: Number(rating), body });
    if (!parsed.success) {
      setReviewError(Object.values(fieldErrors(parsed.error))[0] ?? 'Avaliação inválida.');
      return;
    }
    setBusy(true);
    try {
      const { error: insertError } = await requireSupabase().from('reviews').insert({
        game_id: game.id,
        rating: parsed.data.rating,
        body: parsed.data.body,
      });
      if (insertError) throw insertError;
      setBody('');
      setReviewError('');
      load();
    } catch (reason) {
      setReviewError(messageFrom(reason));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Image source={mediaUrl(game.cover_path) ? { uri: mediaUrl(game.cover_path)! } : undefined} style={styles.cover} contentFit="cover" />
      <Text variant="headlineSmall">{game.title}</Text>
      <Text variant="titleLarge">{formatMoney(game.price_cents, game.currency)}</Text>
      <View style={styles.row}>
        <Chip>{game.genre}</Chip>
        {game.platforms.map((platform) => <Chip key={platform}>{platform}</Chip>)}
      </View>
      <Text>Versão {game.current_version} · {formatBytes(game.file_size_bytes)} · classificação {game.age_rating}</Text>
      <Text>Desenvolvedor: {developer ?? 'GameStore Studio'}</Text>
      <Text>Nota {Number(game.average_rating).toFixed(1)} ({game.ratings_count})</Text>
      {game.developer_website ? <Button mode="text" onPress={() => Linking.openURL(game.developer_website!)}>Site do desenvolvedor</Button> : null}
      {game.privacy_policy_url ? <Button mode="text" onPress={() => Linking.openURL(game.privacy_policy_url!)}>Política de privacidade</Button> : null}
      {owned ? (
        <Button mode="contained" loading={busy} onPress={() => download(latest?.platform ?? game.platforms[0])}>
          Baixar / atualizar
        </Button>
      ) : (
        <Button mode="contained" onPress={buy}>Comprar</Button>
      )}
      {downloadMessage ? <HelperText type="info">{downloadMessage}</HelperText> : null}
      <Text variant="titleMedium">Descrição</Text>
      <Text>{game.description}</Text>
      <Text variant="titleMedium">Requisitos mínimos</Text>
      <Text>{game.min_requirements}</Text>
      <Text variant="titleMedium">Requisitos recomendados</Text>
      <Text>{game.recommended_requirements}</Text>
      <Text variant="titleMedium">Capturas</Text>
      {images.length === 0 ? <Text>Nenhuma captura enviada.</Text> : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
          {images.map((image) => (
            <Image key={image.id} source={{ uri: mediaUrl(image.storage_path) ?? '' }} style={styles.shot} contentFit="cover" accessibilityLabel={image.alt_text || game.title} />
          ))}
        </ScrollView>
      )}
      <Text variant="titleMedium">Trailer</Text>
      {!trailerUrl ? <Text>Nenhum trailer enviado.</Text> : null}
      {trailerUrl && isDirectVideo(trailerUrl) ? <Trailer url={trailerUrl} /> : null}
      {trailerUrl && !isDirectVideo(trailerUrl) ? (
        <Button mode="outlined" onPress={() => Linking.openURL(trailerUrl)}>Assistir trailer</Button>
      ) : null}
      {owned ? (
        <View style={styles.block}>
          <Text variant="titleMedium">Versões</Text>
          {versions.length === 0 ? <Text>Nenhuma versão publicada.</Text> : versions.map((version) => (
            <Card key={version.id} mode="outlined">
              <Card.Title title={`${version.version_name} · ${version.platform}`} subtitle={version.is_latest ? 'Mais recente' : version.file_name} />
              <Card.Content><Text>{version.changelog || 'Sem notas desta versão.'}</Text></Card.Content>
              <Card.Actions>
                <Button onPress={() => download(version.platform)}>Baixar esta plataforma</Button>
              </Card.Actions>
            </Card>
          ))}
        </View>
      ) : null}
      <Text variant="titleMedium">Avaliações</Text>
      {reviews.length === 0 ? <Text>Seja a primeira pessoa a avaliar depois da compra.</Text> : reviews.map((review) => (
        <Card key={review.id} mode="outlined">
          <Card.Title title={review.author_name} subtitle={`${review.rating}/5`} />
          <Card.Content><Text>{review.body || 'Sem comentário.'}</Text></Card.Content>
        </Card>
      ))}
      {owned ? (
        <View style={styles.block}>
          <TextInput mode="outlined" label="Nota de 1 a 5" value={rating} onChangeText={setRating} keyboardType="number-pad" />
          <TextInput mode="outlined" label="Comentário" value={body} onChangeText={setBody} multiline />
          {reviewError ? <HelperText type="error">{reviewError}</HelperText> : null}
          <Button mode="contained" loading={busy} onPress={sendReview}>Publicar avaliação</Button>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 12, paddingBottom: 40 },
  cover: { width: '100%', height: 240, borderRadius: 16, backgroundColor: '#241F3D' },
  shot: { width: 220, height: 124, borderRadius: 12, backgroundColor: '#241F3D' },
  video: { width: '100%', height: 220, borderRadius: 12, backgroundColor: '#000000' },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  block: { gap: 8 },
});
