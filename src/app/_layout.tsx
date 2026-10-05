import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

import { AuthProvider, useAuth } from '@/context/AuthContext';
import { CartProvider } from '@/context/CartContext';
import { ThemeController, useThemeChoice } from '@/theme/theme';

SplashScreen.preventAutoHideAsync().catch(() => undefined);

function RootStack() {
  const { ready } = useAuth();
  const { isDark, theme } = useThemeChoice();

  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => undefined);
  }, [ready]);

  return (
    <PaperProvider
      theme={theme}
      settings={{
        icon: ({ name, color, size }) => (
          <MaterialCommunityIcons name={name as never} color={color} size={size} />
        ),
      }}
    >
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: true }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="game/[id]" options={{ title: 'Jogo' }} />
        <Stack.Screen name="auth/login" options={{ title: 'Entrar' }} />
        <Stack.Screen name="auth/callback" options={{ title: 'Login', headerShown: false }} />
        <Stack.Screen name="auth/register" options={{ title: 'Criar conta' }} />
        <Stack.Screen name="auth/forgot-password" options={{ title: 'Recuperar senha' }} />
        <Stack.Screen name="auth/reset" options={{ title: 'Nova senha' }} />
        <Stack.Screen name="checkout/index" options={{ title: 'Checkout' }} />
        <Stack.Screen name="checkout/result" options={{ title: 'Pagamento' }} />
        <Stack.Screen name="legal/privacy" options={{ title: 'Privacidade' }} />
        <Stack.Screen name="legal/terms" options={{ title: 'Termos de uso' }} />
        <Stack.Screen name="legal/delete-account" options={{ title: 'Excluir conta' }} />
        <Stack.Screen name="admin" options={{ headerShown: false }} />
        <Stack.Screen name="studio" options={{ headerShown: false }} />
      </Stack>
    </PaperProvider>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeController>
          <AuthProvider>
            <CartProvider>
              <RootStack />
            </CartProvider>
          </AuthProvider>
        </ThemeController>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
