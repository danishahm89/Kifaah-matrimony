import React from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Alert } from '../utils/alert';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import { Screen } from '../components/Screen';
import { Header } from '../components/Header';
import { Button } from '../components/Button';
import { ShieldIcon } from '../icons';
import { colors, fonts, themedStyles } from '../theme/tokens';
import { useProfileDetail, useRequestPhoto, useAcceptPhotoRequest, useRejectPhotoRequest } from '../api/hooks/useDiscover';
import { useSendInterest } from '../api/hooks/useInterests';
import { useBlockUser } from '../api/hooks/useBlocks';
import { useAuthStore } from '../store/authStore';
import { useToastStore } from '../store/uiStore';
import { useScreenshotReporting } from '../hooks/useScreenshotReporting';
import { ApiError } from '../api/client';
import { resolvePhotoUrl } from '../api/client';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'ProfileDetail'>;

export function ProfileDetailScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<Props['route']>();
  const { profileId } = route.params;
  const chaperoneOn = useAuthStore((s) => s.user?.chaperoneChat ?? true);
  const showToast = useToastStore((s) => s.show);

  // CONTRACT.md §8.10 — a private photo can render here, so this is one of the screens
  // `usePreventScreenCapture` covers. No conversationId (a profile view isn't tied to one, and one
  // may not exist yet pre-connection) — pass targetUserId instead so the backend still knows who
  // to notify (this profile's owner), per the backend's own §8.10 deviation #5.
  useScreenshotReporting(undefined, profileId);

  const { data: detail, isLoading, isError, refetch } = useProfileDetail(profileId);
  const sendInterest = useSendInterest();
  const requestPhoto = useRequestPhoto(profileId);
  const acceptPhotoRequest = useAcceptPhotoRequest(profileId);
  const rejectPhotoRequest = useRejectPhotoRequest(profileId);
  const blockUser = useBlockUser();

  const onBlock = () => {
    if (!detail) return;
    Alert.alert('Block this user?', 'Are you sure you want to block this user?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Block',
        style: 'destructive',
        onPress: () =>
          blockUser.mutate(profileId, {
            onSuccess: () => {
              showToast(`${detail.name} has been blocked.`);
              navigation.goBack();
            },
            onError: () => showToast('Could not block this user. Please try again.'),
          }),
      },
    ]);
  };

  if (isError && !detail) {
    return (
      <Screen>
        <Header title="Profile" onBack={() => navigation.goBack()} />
        <View style={styles.loading}>
          <Text style={styles.errorText}>We couldn't load this profile. It may no longer be available.</Text>
          <View style={{ height: 14 }} />
          <Button title="Try again" variant="outline" onPress={() => refetch()} />
        </View>
      </Screen>
    );
  }

  if (isLoading || !detail) {
    return (
      <Screen>
        <Header title="Profile" onBack={() => navigation.goBack()} />
        <View style={styles.loading}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </Screen>
    );
  }

  const sections: { title: string; icon: string; fields: { label: string; value?: string | null }[] }[] = [
    {
      title: 'About',
      icon: '👤',
      fields: [
        { label: 'About / looking for', value: detail.about },
        { label: 'Education & profession', value: detail.eduProf },
        { label: 'Family background', value: detail.family },
        { label: 'Height / appearance', value: detail.height },
        { label: 'Marital status', value: detail.marital },
        { label: 'Location', value: detail.city },
      ],
    },
    {
      title: 'Deen & practice',
      icon: '🕌',
      fields: [
        { label: 'Sect / manhaj', value: detail.sect },
        { label: 'Prayer', value: detail.prayer },
        { label: 'Modesty', value: detail.modesty },
        { label: 'Fasting', value: detail.fasting },
        { label: "Qur'an recitation", value: detail.quran },
        { label: 'Hajj / Umrah', value: detail.hajj },
        { label: 'View on polygamy', value: detail.polygamy },
      ],
    },
    {
      title: 'Lifestyle',
      icon: '🌿',
      fields: [
        { label: 'Diet', value: detail.diet },
        { label: 'Smoking', value: detail.smoking },
        { label: 'Habits', value: detail.habits },
        { label: 'Likes', value: detail.likes },
        { label: 'Dislikes', value: detail.dislikes },
      ],
    },
  ];

  const guardianNoteText = chaperoneOn
    ? 'Notified automatically once contact is shared.'
    : 'Kept on file; not notified in this mode.';

  // §8.4 — the existing subscribed+accepted gate (`locked`/`lockMessage`, unchanged) now only
  // controls whether "Request Photo" is offered at all; `photoUrl` is null unless BOTH that gate
  // and a separately-accepted PhotoAccessRequest are true, so treat "no photoUrl" as locked.
  const locked = !!detail.locked;
  const photoUnlocked = !locked && !!detail.photoUrl;
  const photoAccessStatus = detail.photoAccessStatus ?? 'none';
  const good = detail.score >= 65;
  const initials = detail.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');

  const onSendInterest = () => {
    sendInterest.mutate(profileId, {
      onSuccess: () => showToast(`Interest sent to ${detail.name}.`),
      onError: (err) => {
        if (err instanceof ApiError && err.body?.error === 'subscription_required') {
          navigation.navigate('Pricing', { returnTo: 'detail', pendingInterestProfileId: profileId });
        } else {
          showToast('Could not send interest. Please try again.');
        }
      },
    });
  };

  const actionArea = (
    <>
      {detail.interestStatus === 'none' || detail.interestStatus === 'declined' ? (
        <Button title="Send interest" onPress={onSendInterest} loading={sendInterest.isPending} />
      ) : null}
      {detail.interestStatus === 'sent' ? (
        <View style={styles.statusBox}>
          <Text style={styles.statusText}>⏳ Interest sent — awaiting response</Text>
        </View>
      ) : null}
      {detail.interestStatus === 'accepted' ? (
        <Button
          title="Message"
          onPress={() => navigation.navigate('ChatThread', { userId: profileId, name: detail.name })}
        />
      ) : null}
      {detail.interestStatus === 'received' ? (
        <View style={styles.statusBox}>
          <Text style={styles.statusText}>💌 They are interested in you — reply from Requests › Received</Text>
        </View>
      ) : null}
    </>
  );

  return (
    <Screen>
      <Header
        title={detail.name}
        onBack={() => navigation.goBack()}
        right={<Button title="Block" variant="text" onPress={onBlock} />}
      />
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Hero */}
        <View style={styles.hero}>
          <View style={styles.photoWrap}>
            {photoUnlocked ? (
              <Image source={{ uri: resolvePhotoUrl(detail.photoUrl)! }} style={styles.photoImage} />
            ) : (
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{initials}</Text>
              </View>
            )}
          </View>
          <Text style={styles.name}>
            {detail.name}, {detail.age}
          </Text>
          {detail.city ? <Text style={styles.heroMeta}>📍 {detail.city}</Text> : null}
          <View style={[styles.scorePill, { backgroundColor: good ? colors.greenBg : colors.lowBg }]}>
            <Text style={[styles.scoreText, { color: good ? colors.greenText : colors.lowText }]}>
              {detail.score}% compatible
            </Text>
          </View>
          <View style={styles.tagRow}>
            {[detail.sect, detail.prayer, detail.modesty].filter(Boolean).map((t, i) => (
              <View key={i} style={styles.tag}>
                <Text style={styles.tagText}>{t}</Text>
              </View>
            ))}
          </View>
          {!photoUnlocked ? (
            <Text style={styles.lockNote}>🔒 {detail.lockMessage || 'Photo stays private until approved.'}</Text>
          ) : null}
        </View>

        <View style={styles.actionTop}>{actionArea}</View>

        {/* §8.4 — explicit photo consent, on top of (not instead of) the subscribed+accepted gate. */}
        {!locked && !photoUnlocked ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>📷 Profile photo</Text>
            {photoAccessStatus === 'pending' ? (
              <Text style={styles.cardText}>Photo request sent — awaiting response.</Text>
            ) : (
              <>
                <Text style={[styles.cardText, { marginBottom: 12 }]}>
                  {photoAccessStatus === 'rejected'
                    ? `${detail.name} declined your last request to view their photo.`
                    : `${detail.name}'s photo stays hidden until they approve your request.`}
                </Text>
                <Button
                  title={photoAccessStatus === 'rejected' ? 'Request again' : 'Request photo'}
                  variant="outline"
                  onPress={() =>
                    requestPhoto.mutate(undefined, {
                      onSuccess: () => showToast('Photo request sent.'),
                      onError: () => showToast('Could not send a photo request. Please try again.'),
                    })
                  }
                  loading={requestPhoto.isPending}
                />
              </>
            )}
          </View>
        ) : null}

        {detail.incomingPhotoRequest?.status === 'pending' ? (
          <View style={styles.card}>
            <Text style={styles.cardText}>{detail.name} has asked to view your profile photo.</Text>
            <View style={[styles.actions, { marginTop: 12 }]}>
              <Button
                title="Accept"
                variant="small-primary"
                onPress={() =>
                  acceptPhotoRequest.mutate(detail.incomingPhotoRequest!.id, {
                    onSuccess: () => showToast('Photo request accepted.'),
                    onError: () => showToast('Could not accept this request. Please try again.'),
                  })
                }
              />
              <Button
                title="Reject"
                variant="small-outline"
                onPress={() =>
                  rejectPhotoRequest.mutate(detail.incomingPhotoRequest!.id, {
                    onError: () => showToast('Could not reject this request. Please try again.'),
                  })
                }
              />
            </View>
          </View>
        ) : null}

        {sections.map((sec) => (
          <View key={sec.title} style={styles.card}>
            <Text style={styles.cardTitle}>
              {sec.icon} {sec.title}
            </Text>
            {sec.fields.map((f, i) => (
              <View key={f.label} style={[styles.fieldRow, i === 0 && { borderTopWidth: 0, paddingTop: 0 }]}>
                <Text style={styles.fieldLabel}>{f.label}</Text>
                <Text style={styles.fieldValue}>{f.value || '—'}</Text>
              </View>
            ))}
          </View>
        ))}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>📞 Contact details</Text>
          {detail.contact ? (
            <>
              <Text style={styles.fieldValue}>{detail.contact.phone}</Text>
              <Text style={styles.fieldValue}>{detail.contact.email}</Text>
            </>
          ) : (
            <>
              <Text style={[styles.fieldValue, { opacity: 0.45 }]}>+91 •• •••• ••••</Text>
              <Text style={styles.cardText}>Unlocks after an active subscription and a mutual accepted interest.</Text>
            </>
          )}
        </View>

        <View style={[styles.card, styles.guardianCard]}>
          <ShieldIcon color={colors.greenText} />
          <View style={{ flex: 1 }}>
            <Text style={styles.guardianText}>
              Guardian (Wali): <Text style={{ fontFamily: fonts.extraBold }}>{detail.wali || '—'}</Text>
            </Text>
            <Text style={styles.cardText}>{guardianNoteText}</Text>
          </View>
        </View>

        <View style={styles.actionBottom}>{actionArea}</View>
      </ScrollView>
    </Screen>
  );
}

const styles = themedStyles(() =>
  StyleSheet.create({
    loading: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
    errorText: { fontFamily: fonts.regular, fontSize: 14, color: colors.muted, textAlign: 'center' },
    scroll: { padding: 16, gap: 14, paddingBottom: 40 },
    hero: {
      alignItems: 'center',
      backgroundColor: colors.card,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: colors.border,
      paddingVertical: 24,
      paddingHorizontal: 16,
      gap: 8,
    },
    photoWrap: { marginBottom: 6 },
    photoImage: { width: 120, height: 120, borderRadius: 60, borderWidth: 3, borderColor: colors.accent },
    avatar: {
      width: 110,
      height: 110,
      borderRadius: 55,
      backgroundColor: colors.greenBg,
      borderWidth: 3,
      borderColor: colors.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarText: { fontFamily: fonts.extraBold, fontSize: 36, color: colors.greenText },
    name: { fontFamily: fonts.extraBold, fontSize: 22, color: colors.ink, textAlign: 'center' },
    heroMeta: { fontFamily: fonts.regular, fontSize: 14, color: colors.muted },
    scorePill: { paddingVertical: 6, paddingHorizontal: 14, borderRadius: 20, marginTop: 4 },
    scoreText: { fontFamily: fonts.extraBold, fontSize: 13 },
    tagRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 6, marginTop: 6 },
    tag: {
      paddingVertical: 5,
      paddingHorizontal: 12,
      borderRadius: 20,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.borderHairline,
    },
    tagText: { fontSize: 12, fontFamily: fonts.semiBold, color: colors.ink },
    lockNote: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted, marginTop: 6, textAlign: 'center' },
    actionTop: { gap: 8 },
    actionBottom: { gap: 8, marginTop: 4 },
    card: {
      backgroundColor: colors.card,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 16,
    },
    cardTitle: { fontFamily: fonts.extraBold, fontSize: 15, color: colors.ink, marginBottom: 12 },
    cardText: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted, marginTop: 4, lineHeight: 19 },
    fieldRow: { borderTopWidth: 1, borderTopColor: colors.borderHairline, paddingTop: 10, marginTop: 10 },
    fieldLabel: {
      fontSize: 11,
      letterSpacing: 0.4,
      textTransform: 'uppercase',
      color: colors.muted,
      fontFamily: fonts.semiBold,
    },
    fieldValue: { fontSize: 14, marginTop: 4, lineHeight: 20, color: colors.ink, fontFamily: fonts.regular },
    guardianCard: { flexDirection: 'row', gap: 12, alignItems: 'flex-start', backgroundColor: colors.greenBg },
    guardianText: { fontSize: 14, color: colors.ink, fontFamily: fonts.regular },
    statusBox: { padding: 14, borderRadius: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
    statusText: { fontFamily: fonts.semiBold, fontSize: 14, color: colors.ink, textAlign: 'center' },
    actions: { flexDirection: 'row', gap: 8 },
  })
);
