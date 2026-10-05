import { router, Stack } from 'expo-router';
import { Button } from 'react-native-paper';

import { EmptyState, LoadingState } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';

export default function StudioLayout() {
  const { ready, session } = useAuth();
  if (!ready) return <LoadingState label="Verificando conta..." />;
  if (!session) {
    return (
      <EmptyState
        title="Faça login para publicar um jogo."
        body="A publicação fica ligada à sua conta de desenvolvedor."
        action={<Button mode="contained" onPress={() => router.replace('/auth/login')}>Entrar</Button>}
      />
    );
  }
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: 'Meus jogos' }} />
      <Stack.Screen name="[id]" options={{ title: 'Publicar jogo' }} />
    </Stack>
  );
}
