import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, HelperText, Text, TextInput } from 'react-native-paper';

import { useAuth } from '@/context/AuthContext';
import { messageFrom } from '@/lib/supabase';
import { deleteAccount } from '@/services/store';

export default function DeleteAccountScreen() {
  const { session, signOut } = useAuth();
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (confirmation !== 'EXCLUIR') {
      setError('Digite EXCLUIR em maiúsculas para confirmar.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await deleteAccount();
      await signOut().catch(() => undefined);
      router.replace('/');
    } catch (reason) {
      setError(messageFrom(reason));
    } finally {
      setLoading(false);
    }
  };

  if (!session) {
    return (
      <View style={styles.content}>
        <Text>Entre na sua conta para solicitar a exclusão.</Text>
        <Button mode="contained" onPress={() => router.push('/auth/login')}>Entrar</Button>
      </View>
    );
  }

  return (
    <View style={styles.content}>
      <Text variant="headlineSmall">Excluir conta</Text>
      <Text>
        Esta ação remove o acesso, as avaliações e os dados de perfil. Pedidos já pagos podem permanecer sem o seu e-mail, como registro da venda. Os arquivos dos jogos não são apagados para outros compradores.
      </Text>
      <TextInput mode="outlined" label="Digite EXCLUIR" value={confirmation} onChangeText={setConfirmation} autoCapitalize="characters" />
      {error ? <HelperText type="error">{error}</HelperText> : null}
      <Button mode="contained" buttonColor="#B3261E" loading={loading} onPress={submit}>Excluir minha conta</Button>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 12 },
});
