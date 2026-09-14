import React from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Screen } from '../components/Screen';
import { Header } from '../components/Header';
import { colors, fonts } from '../theme/tokens';
import { useFaq } from '../api/hooks/useFaq';
import type { RootStackParamList } from '../navigation/types';

export function FAQScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { data: faqs = [], isLoading } = useFaq();

  return (
    <Screen>
      <Header title="FAQs" onBack={() => navigation.goBack()} />
      {isLoading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.red} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll}>
          {faqs.map((q, i) => (
            <View key={i} style={styles.item}>
              <Text style={styles.question}>{q.question}</Text>
              <Text style={styles.answer}>{q.answer}</Text>
            </View>
          ))}
        </ScrollView>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    paddingBottom: 32,
  },
  item: {
    borderBottomWidth: 1,
    borderBottomColor: colors.borderHairline,
    paddingVertical: 14,
  },
  question: {
    fontFamily: fonts.extraBold,
    fontSize: 13,
    color: colors.ink,
  },
  answer: {
    fontSize: 13,
    lineHeight: 20,
    color: colors.muted,
    marginTop: 6,
    fontFamily: fonts.regular,
  },
});
