import { Link, Stack } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';

export default function NotFound() {
  return (
    <View style={styles.page}>
      <Stack.Screen options={{ title: 'Página não encontrada' }} />
      <Text variant="headlineSmall">Esta página não existe.</Text>
      <Link href="/" style={styles.link}>Voltar ao início</Link>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  link: { fontSize: 16 },
});
