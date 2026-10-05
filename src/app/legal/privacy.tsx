import { ScrollView, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';

import { privacyPolicy } from '@/content/legal';

export default function PrivacyScreen() {
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text>{privacyPolicy}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({ content: { padding: 16, paddingBottom: 40 } });
