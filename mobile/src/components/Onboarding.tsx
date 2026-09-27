import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { tr } from '../i18n/t';
import { colors, fonts, themedStyles } from '../theme/tokens';

// "Step 1 of 2" bar shown at the top of sign-up.
export function StepProgress({ step, total, label }: { step: number; total: number; label: string }) {
  const w = useRef(new Animated.Value((step - 1) / total)).current;
  useEffect(() => {
    Animated.timing(w, { toValue: step / total, duration: 500, useNativeDriver: false }).start();
  }, [step, total, w]);
  return (
    <View style={styles.progressWrap}>
      <View style={styles.progressTop}>
        <Text style={styles.stepText}>{tr('Step {step} of {total}', { step, total })}</Text>
        <Text style={styles.stepLabel}>{tr(label)}</Text>
      </View>
      <View style={styles.track}>
        <Animated.View
          style={[styles.fill, { width: w.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }]}
        />
      </View>
    </View>
  );
}

// Rounded card that groups related questions, with an icon and a short title.
export function FormCard({
  icon,
  title,
  hint,
  children,
}: {
  icon: string;
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHead}>
        <View style={styles.iconBubble}>
          <Text style={styles.icon}>{icon}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle}>{tr(title)}</Text>
          {hint ? <Text style={styles.cardHint}>{tr(hint)}</Text> : null}
        </View>
      </View>
      <View style={styles.cardBody}>{children}</View>
    </View>
  );
}

const styles = themedStyles(() =>
  StyleSheet.create({
    progressWrap: { gap: 8, marginBottom: 4 },
    progressTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
    stepText: { fontFamily: fonts.extraBold, fontSize: 12, color: colors.primary, letterSpacing: 0.5 },
    stepLabel: { fontFamily: fonts.semiBold, fontSize: 12, color: colors.muted },
    track: { height: 8, borderRadius: 4, backgroundColor: colors.borderHairline, overflow: 'hidden' },
    fill: { height: 8, borderRadius: 4, backgroundColor: colors.accent },
    card: {
      backgroundColor: colors.card,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 16,
      gap: 14,
    },
    cardHead: { flexDirection: 'row', gap: 12, alignItems: 'center' },
    iconBubble: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.greenBg,
      alignItems: 'center',
      justifyContent: 'center',
    },
    icon: { fontSize: 20 },
    cardTitle: { fontFamily: fonts.extraBold, fontSize: 16, color: colors.ink },
    cardHint: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted, marginTop: 2 },
    cardBody: { gap: 16 },
  })
);
