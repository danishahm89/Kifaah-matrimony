import React from 'react';
import { tr } from '../i18n/t';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Screen } from '../components/Screen';
import { Header } from '../components/Header';
import { colors, fonts, themedStyles } from '../theme/tokens';
import { useAuthStore } from '../store/authStore';
import { SUPPORT_EMAIL, SUPPORT_WHATSAPP } from '../config/support';
import type { RootStackParamList } from '../navigation/types';

function Row({ icon, title, text, onPress }: { icon: string; title: string; text: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}>
      <Text style={styles.icon}>{icon}</Text>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle}>{tr(title)}</Text>
        <Text style={styles.rowText}>{tr(text)}</Text>
      </View>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

export function SupportScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const user = useAuthStore((s) => s.user);
  const ref = user?.id ? `\n\nAccount ref: ${user.id}` : '';

  const openEmail = () => {
    const subject = encodeURIComponent('Kifaah support request');
    const body = encodeURIComponent(`Please describe your issue here.${ref}`);
    Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`).catch(() => {});
  };
  const openWhatsApp = () => {
    const text = encodeURIComponent(`Assalamu alaikum, I need help with Kifaah.${ref}`);
    Linking.openURL(`https://wa.me/${SUPPORT_WHATSAPP}?text=${text}`).catch(() => {});
  };

  return (
    <Screen>
      <Header title={tr("Help & Support")} onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.lead}>{tr("We are here to help. Pick how you want to reach us.")}</Text>

        <Row icon="📖" title={tr("FAQs")} text={tr("Quick answers to common questions")} onPress={() => navigation.navigate('FAQ')} />
        {SUPPORT_WHATSAPP ? (
          <Row icon="💬" title={tr("Chat on WhatsApp")} text={tr("Fastest reply, usually within a few hours")} onPress={openWhatsApp} />
        ) : null}
        {SUPPORT_EMAIL ? <Row icon="✉️" title={tr("Email us")} text={SUPPORT_EMAIL} onPress={openEmail} /> : null}

        <View style={styles.note}>
          <Text style={styles.noteTitle}>{tr("Safety concern?")}</Text>
          <Text style={styles.noteText}>
            {tr("If someone is behaving badly, block them from their profile or chat, then tell us. We review every report.")}
          </Text>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = themedStyles(() =>
  StyleSheet.create({
    scroll: { padding: 20, gap: 12, paddingBottom: 40 },
    lead: { fontFamily: fonts.regular, fontSize: 14, color: colors.muted, marginBottom: 4 },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      padding: 16,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
    },
    icon: { fontSize: 22 },
    rowTitle: { fontFamily: fonts.extraBold, fontSize: 15, color: colors.ink },
    rowText: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted, marginTop: 2 },
    chevron: { fontSize: 24, color: colors.muted },
    note: { marginTop: 12, padding: 16, borderRadius: 14, backgroundColor: colors.greenBg },
    noteTitle: { fontFamily: fonts.extraBold, fontSize: 14, color: colors.greenText },
    noteText: { fontFamily: fonts.regular, fontSize: 13, color: colors.ink, marginTop: 4, lineHeight: 19 },
  })
);
