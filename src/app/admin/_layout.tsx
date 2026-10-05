import { router, Stack } from 'expo-router';
import { Button } from 'react-native-paper';

import { EmptyState, LoadingState } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';

export default function AdminLayout() {
  const { ready, session, profile } = useAuth();
  if (!ready || (session && !profile)) return <LoadingState label="Verificando permissão..." />;
  if (profile?.role !== 'admin') {
    return (
      <EmptyState
        title="Área do proprietário"
        body="Somente uma conta com papel de administrador pode abrir este painel. A regra também está no banco de dados."
        action={<Button mode="contained" onPress={() => router.replace('/profile')}>Voltar ao perfil</Button>}
      />
    );
  }
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: 'Administração' }} />
      <Stack.Screen name="games/index" options={{ title: 'Jogos' }} />
      <Stack.Screen name="games/[id]" options={{ title: 'Jogo' }} />
      <Stack.Screen name="orders" options={{ title: 'Pedidos' }} />
      <Stack.Screen name="users" options={{ title: 'Usuários' }} />
      <Stack.Screen name="coupons" options={{ title: 'Cupons' }} />
      <Stack.Screen name="categories" options={{ title: 'Categorias' }} />
      <Stack.Screen name="sales" options={{ title: 'Vendas' }} />
      <Stack.Screen name="reviews/index" options={{ title: 'Jogos pendentes' }} />
      <Stack.Screen name="reviews/[id]" options={{ title: 'Análise' }} />
      <Stack.Screen name="downloads" options={{ title: 'Downloads' }} />
    </Stack>
  );
}
