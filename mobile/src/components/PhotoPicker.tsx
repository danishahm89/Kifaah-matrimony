import React from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { tr } from '../i18n/t';
import { colors, fonts, themedStyles } from '../theme/tokens';
import { GenderAvatar } from './GenderAvatar';

interface Props {
  gender: 'bride' | 'groom';
  uri: string | null;
  uploading: boolean;
  error?: string | null;
  onPick: () => void;
  onRemove?: () => void;
}

// Profile photo area for sign-up: big round preview, camera badge, clear status, and a privacy
// reminder so people feel safe adding a photo.
export function PhotoPicker({ gender, uri, uploading, error, onPick, onRemove }: Props) {
  const saved = !!uri && !uploading && !error;
  return (
    <View style={styles.wrap}>
      <Pressable
        onPress={onPick}
        style={({ hovered, pressed }: any) => [styles.circle, (hovered || pressed) && styles.circleHover]}
        accessibilityRole="button"
        accessibilityLabel={uri ? 'Change photo' : 'Add photo'}
      >
        {uri ? <Image source={{ uri }} style={styles.img} /> : <GenderAvatar gender={gender} size={132} />}
        {uploading ? (
          <View style={styles.overlay}>
            <ActivityIndicator color="#fff" />
            <Text style={styles.overlayText}>{tr('Uploading…')}</Text>
          </View>
        ) : null}
        <View style={styles.camBadge}>
          <Text style={styles.cam}>📷</Text>
        </View>
      </Pressable>

      <View style={styles.side}>
        <Text style={styles.title}>{saved ? tr('✓ Photo saved') : tr('Add a profile photo')}</Text>
        <Text style={styles.sub}>
          {tr('Members with a photo get more replies. A clear, modest photo of your face works best.')}
        </Text>
        <View style={styles.actions}>
          <Pressable onPress={onPick} style={({ hovered }: any) => [styles.btn, hovered && styles.btnHover]}>
            <Text style={styles.btnText}>{uri ? tr('Change photo') : tr('Choose photo')}</Text>
          </Pressable>
          {uri && onRemove ? (
            <Pressable onPress={onRemove} style={styles.linkBtn}>
              <Text style={styles.linkText}>{tr('Remove')}</Text>
            </Pressable>
          ) : null}
        </View>
        <View style={styles.privacy}>
          <Text style={styles.privacyText}>
            🛡 {tr('Private by default: blurred for everyone until you approve their photo request.')}
          </Text>
        </View>
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>
    </View>
  );
}

const styles = themedStyles(() =>
  StyleSheet.create({
    wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 18, alignItems: 'center' },
    circle: {
      width: 140,
      height: 140,
      borderRadius: 70,
      borderWidth: 3,
      borderColor: colors.accent,
      borderStyle: 'dashed',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface,
    },
    circleHover: { borderStyle: 'solid', transform: [{ scale: 1.02 }] },
    img: { width: 132, height: 132, borderRadius: 66 },
    overlay: {
      position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
      borderRadius: 70,
      backgroundColor: 'rgba(0,0,0,0.45)',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
    },
    overlayText: { color: '#fff', fontFamily: fonts.semiBold, fontSize: 12 },
    camBadge: {
      position: 'absolute',
      right: 4,
      bottom: 4,
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 3,
      borderColor: colors.card,
    },
    cam: { fontSize: 16 },
    side: { flex: 1, minWidth: 200, gap: 8 },
    title: { fontFamily: fonts.extraBold, fontSize: 16, color: colors.ink },
    sub: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted, lineHeight: 18 },
    actions: { flexDirection: 'row', gap: 12, alignItems: 'center', marginTop: 4 },
    btn: { backgroundColor: colors.primary, paddingVertical: 9, paddingHorizontal: 16, borderRadius: 10 },
    btnHover: { opacity: 0.9 },
    btnText: { color: colors.white, fontFamily: fonts.extraBold, fontSize: 13 },
    linkBtn: { paddingVertical: 9 },
    linkText: { color: colors.redDark, fontFamily: fonts.semiBold, fontSize: 13 },
    privacy: { backgroundColor: colors.greenBg, borderRadius: 10, padding: 10, marginTop: 4 },
    privacyText: { color: colors.greenText, fontFamily: fonts.semiBold, fontSize: 12, lineHeight: 17 },
    error: { color: colors.redDark, fontFamily: fonts.semiBold, fontSize: 12 },
  })
);
