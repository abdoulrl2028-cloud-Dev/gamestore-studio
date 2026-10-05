import { ScrollView, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';

import { termsOfUse } from '@/content/legal';

export default function TermsScreen() {
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text>{termsOfUse}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({ content: { padding: 16, paddingBottom: 40 } });
