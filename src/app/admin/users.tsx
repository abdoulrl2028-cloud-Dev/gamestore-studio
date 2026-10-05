import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { Button, Card, Text } from 'react-native-paper';

import { ErrorState, LoadingState } from '@/components/ui';
import { messageFrom, requireSupabase } from '@/lib/supabase';
import { listProfiles } from '@/services/store';
import type { Profile } from '@/types';

export default function AdminUsersScreen() {
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    listProfiles()
      .then((next) => {
        setUsers(next);
        setError('');
      })
      .catch((reason) => setError(messageFrom(reason)))
      .finally(() => setLoading(false));
  }, []);

  useFocusEffect(useCallback(() => {
    load();
  }, [load]));

  const setRole = async (user: Profile) => {
    const next = user.role === 'user' ? 'developer' : user.role === 'developer' ? 'admin' : 'user';
    const { error: roleError } = await requireSupabase().rpc('admin_set_role', { p_user_id: user.id, p_role: next });
    if (roleError) setError(roleError.message);
    else load();
  };

  if (loading) return <LoadingState />;
  if (error && users.length === 0) return <ErrorState message={error} onRetry={load} />;

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text>Promover outra pessoa só deve acontecer com quem realmente administra a loja. O último administrador não pode ser rebaixado.</Text>
      {error ? <Text>{error}</Text> : null}
      {users.map((user) => (
        <Card key={user.id} mode="outlined">
          <Card.Title title={user.display_name} subtitle={`${user.email ?? 'sem e-mail'} · ${user.role}`} />
          <Card.Actions>
            <Button onPress={() => setRole(user)}>
              {user.role === 'user' ? 'Tornar desenvolvedor' : user.role === 'developer' ? 'Tornar administrador' : 'Tornar usuário'}
            </Button>
          </Card.Actions>
        </Card>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({ content: { padding: 16, gap: 12 } });
