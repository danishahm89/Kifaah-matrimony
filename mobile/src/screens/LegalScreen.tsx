import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import { tr } from '../i18n/t';
import { Screen } from '../components/Screen';
import { Header } from '../components/Header';
import { SegmentRow } from '../components/SegmentRow';
import { colors, fonts, themedStyles } from '../theme/tokens';
import {
  GRIEVANCE_OFFICER_NAME,
  LEGAL_LAST_UPDATED,
  SUPPORT_EMAIL,
  SUPPORT_WHATSAPP,
} from '../config/support';
import type { RootStackParamList } from '../navigation/types';

export type LegalDoc = 'terms' | 'privacy' | 'refund' | 'grievance';

type Section = { h: string; p: string[] };

const whatsapp = SUPPORT_WHATSAPP ? `+${SUPPORT_WHATSAPP}` : '';

const DOCS: Record<LegalDoc, { title: string; sections: Section[] }> = {
  terms: {
    title: 'Terms of Use',
    sections: [
      {
        h: 'Kifaah is for marriage only',
        p: [
          'Kifaah is a matrimonial service for Muslims who want to marry. It is not a dating site.',
          'By using Kifaah you confirm that you are looking for marriage, and that you are of legal age to marry in India (at least 18 for women and 21 for men).',
        ],
      },
      {
        h: 'Your profile',
        p: [
          'Give true and current details. One person, one profile.',
          'A parent, sibling or Wali may help, but the person in the profile must agree to it.',
          'Do not upload photos of other people.',
        ],
      },
      {
        h: 'How to behave',
        p: [
          'Be respectful. No abuse, threats, or sexual messages.',
          'Never ask any member for money, gifts, bank details or OTPs.',
          'Do not use Kifaah for business, marketing or to collect data about members.',
        ],
      },
      {
        h: 'Stay safe',
        p: [
          'Never send money to someone you met online, whatever the reason.',
          'Involve your family or Wali early. Meet in public places with family present.',
          'Report any profile that looks fake or behaves badly. We review every report.',
        ],
      },
      {
        h: 'Our rights',
        p: [
          'We may hide, suspend or remove a profile that breaks these rules, or that we believe is fake or unsafe.',
          'We check reports and use technical checks, but we cannot verify every detail every member gives. Please take care before sharing personal details or meeting anyone.',
        ],
      },
      {
        h: 'Plans and payments',
        p: ['Paid plans are explained on the Pricing screen. See the Refund Policy for refunds.'],
      },
      {
        h: 'Changes',
        p: ['We may update these terms. We will tell you in the app when we make important changes.'],
      },
    ],
  },
  privacy: {
    title: 'Privacy Policy',
    sections: [
      {
        h: 'What we collect',
        p: [
          'Your phone number (to log in), your profile details, faith and family answers, your photo, your Wali details, messages you send, and basic technical logs such as IP address and device type.',
        ],
      },
      {
        h: 'Why we collect it',
        p: [
          'To create your profile, suggest matches, let you talk to matches, keep members safe, handle payments, and meet legal duties.',
          'We do not sell your data. We do not show ads.',
        ],
      },
      {
        h: 'Who can see what',
        p: [
          'Other members see your profile details, but not your photo.',
          'Your photo is shown only to a member you approve, after you both accept an interest.',
          "Your Wali's details are shown only after you both accept an interest.",
          'Your phone and email are shown only after you both accept an interest and the viewer has an active plan.',
        ],
      },
      {
        h: 'Service providers',
        p: [
          'We use trusted providers to run Kifaah: SMS for login codes, Razorpay for payments, and our hosting provider. They only get what they need to do their job.',
        ],
      },
      {
        h: 'How long we keep it',
        p: [
          'While your account is active.',
          'When you delete your account, we delete your profile, photo, messages and interests.',
          'Reports made about a member, and security logs, may be kept for up to 1 year to prevent fraud and meet legal duties.',
        ],
      },
      {
        h: 'Your rights',
        p: [
          'You can see and correct your details, withdraw consent, and delete your account at any time from the Profile tab.',
          'For any privacy question, contact our Grievance Officer (see the Grievance tab).',
        ],
      },
    ],
  },
  refund: {
    title: 'Refund & Cancellation Policy',
    sections: [
      {
        h: 'No automatic renewal',
        p: ['Kifaah plans are one-time payments. They do not renew by themselves. You choose if you want to buy again.'],
      },
      {
        h: 'Full refund',
        p: [
          'If you were charged but your plan did not start, or you were charged twice, contact us. We will refund the extra amount in full.',
          'Refunds go back to the same payment method through Razorpay. Banks usually take 5–7 working days.',
        ],
      },
      {
        h: 'Other requests',
        p: [
          'If you are unhappy for another reason, write to us within 7 days of payment. We review each request fairly.',
          'If your profile is removed for breaking our Terms, the plan is not refunded.',
        ],
      },
      {
        h: 'How to ask',
        p: [`Email ${SUPPORT_EMAIL}${whatsapp ? ` or WhatsApp ${whatsapp}` : ''} with your registered phone number and payment date.`],
      },
    ],
  },
  grievance: {
    title: 'Grievance Redressal',
    sections: [
      {
        h: 'Grievance Officer',
        p: [GRIEVANCE_OFFICER_NAME, `Email: ${SUPPORT_EMAIL}`, whatsapp ? `WhatsApp: ${whatsapp}` : ''].filter(Boolean),
      },
      {
        h: 'What you can raise',
        p: [
          'Fake or abusive profiles, misuse of your photo or data, payment problems, or any concern about how we handle your information.',
        ],
      },
      {
        h: 'Our promise',
        p: [
          'We confirm we got your complaint within 24 hours.',
          'We aim to resolve it within 15 days.',
          'For urgent safety issues, use "Report this profile" on the member\'s profile, and block them.',
        ],
      },
    ],
  },
};

const TABS = [
  { label: 'Terms', value: 'terms' },
  { label: 'Privacy', value: 'privacy' },
  { label: 'Refunds', value: 'refund' },
  { label: 'Grievance', value: 'grievance' },
];

export function LegalScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<NativeStackScreenProps<RootStackParamList, 'Legal'>['route']>();
  const doc: LegalDoc = (route.params?.doc as LegalDoc) || 'terms';
  const content = DOCS[doc] ?? DOCS.terms;

  return (
    <Screen>
      <Header title={tr('Policies')} onBack={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Welcome'))} />
      <ScrollView contentContainerStyle={styles.scroll}>
        <SegmentRow options={TABS} value={doc} onChange={(v) => navigation.setParams({ doc: v as LegalDoc })} />
        <Text style={styles.title}>{tr(content.title)}</Text>
        <Text style={styles.updated}>
          {tr('Last updated')} {LEGAL_LAST_UPDATED}
        </Text>
        {content.sections.map((s) => (
          <View key={s.h} style={styles.section}>
            <Text style={styles.h}>{tr(s.h)}</Text>
            {s.p.map((line) => (
              <Text key={line} style={styles.p}>
                {tr(line)}
              </Text>
            ))}
          </View>
        ))}
      </ScrollView>
    </Screen>
  );
}

const styles = themedStyles(() =>
  StyleSheet.create({
    scroll: { padding: 20, gap: 12, maxWidth: 760, width: '100%', alignSelf: 'center' },
    title: { fontFamily: fonts.extraBold, fontSize: 22, color: colors.ink, marginTop: 8 },
    updated: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted },
    section: { gap: 6, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 16 },
    h: { fontFamily: fonts.semiBold, fontSize: 15, color: colors.ink },
    p: { fontFamily: fonts.regular, fontSize: 14, color: colors.ink, lineHeight: 21 },
  })
);
