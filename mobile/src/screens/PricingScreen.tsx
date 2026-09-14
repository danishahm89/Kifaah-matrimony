import React, { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import { Screen } from '../components/Screen';
import { Header } from '../components/Header';
import { Button } from '../components/Button';
import { SegmentRow } from '../components/SegmentRow';
import { colors, fonts } from '../theme/tokens';
import { usePricing } from '../api/hooks/usePricing';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Pricing'>;
type Billing = 'monthly' | 'annual';

export function PricingScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<Props['route']>();
  const returnTo = route.params?.returnTo ?? 'account';
  const pendingInterestProfileId = route.params?.pendingInterestProfileId;

  const [billing, setBilling] = useState<Billing>('monthly');
  const { data: pricing, isLoading } = usePricing();

  const periodSuffix = billing === 'monthly' ? '/mo' : '/yr';
  const basicPrice = pricing ? pricing.basic[billing] : null;
  const premiumPrice = pricing ? pricing.premium[billing] : null;

  const choose = (tier: 'basic' | 'premium') => {
    navigation.navigate('Payment', { tier, billing, returnTo, pendingInterestProfileId });
  };

  return (
    <Screen>
      <Header title="Membership" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.notice}>
          Subscribe before viewing any photo or contact detail — every profile stays private until you do.
        </Text>

        <SegmentRow
          wrap={false}
          options={[
            { label: 'Monthly', value: 'monthly' },
            { label: 'Annually · save ~2 months', value: 'annual' },
          ]}
          value={billing}
          onChange={(v) => setBilling(v as Billing)}
        />

        {isLoading || basicPrice === null || premiumPrice === null ? (
          <ActivityIndicator color={colors.red} style={{ marginTop: 20 }} />
        ) : (
          <>
            <View style={styles.card}>
              <Text style={styles.tierName}>Basic</Text>
              <Text style={styles.price}>
                ₹{basicPrice}
                <Text style={styles.priceSuffix}>{periodSuffix}</Text>
              </Text>
              <View style={styles.features}>
                <Text style={styles.feature}>— Send interest requests</Text>
                <Text style={styles.feature}>— View photo &amp; contact once matched</Text>
                <Text style={styles.feature}>— Basic search filters</Text>
              </View>
              <Button title="Choose Basic" onPress={() => choose('basic')} align="center" style={styles.chooseBtn} />
            </View>

            <View style={styles.card}>
              <View style={styles.premiumHeader}>
                <Text style={styles.tierName}>Premium</Text>
                <Text style={styles.mostChosen}>Most chosen</Text>
              </View>
              <Text style={styles.price}>
                ₹{premiumPrice}
                <Text style={styles.priceSuffix}>{periodSuffix}</Text>
              </Text>
              <View style={styles.features}>
                <Text style={styles.feature}>— Everything in Basic</Text>
                <Text style={styles.feature}>— See who's interested in you</Text>
                <Text style={styles.feature}>— Priority placement in search</Text>
                <Text style={styles.feature}>— Unlimited interest requests</Text>
              </View>
              <Button title="Choose Premium" onPress={() => choose('premium')} align="center" style={styles.chooseBtn} />
            </View>
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: {
    padding: 20,
    paddingBottom: 32,
    gap: 18,
  },
  notice: {
    fontSize: 13,
    color: colors.muted,
    lineHeight: 20,
    fontFamily: fonts.regular,
  },
  card: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    padding: 18,
  },
  premiumHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  tierName: {
    fontFamily: fonts.extraBold,
    fontSize: 16,
    color: colors.ink,
  },
  mostChosen: {
    fontSize: 10,
    fontFamily: fonts.extraBold,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: colors.redDark,
  },
  price: {
    fontFamily: fonts.extraBold,
    fontSize: 28,
    marginTop: 4,
    color: colors.ink,
  },
  priceSuffix: {
    fontSize: 13,
    fontFamily: fonts.semiBold,
    color: colors.muted,
  },
  features: {
    marginTop: 12,
    gap: 6,
  },
  feature: {
    fontSize: 13,
    color: colors.ink,
    fontFamily: fonts.regular,
  },
  chooseBtn: {
    marginTop: 14,
  },
});
