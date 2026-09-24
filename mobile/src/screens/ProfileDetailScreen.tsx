import React from 'react';
import { ActivityIndicator, Alert, Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import { Screen } from '../components/Screen';
import { Header } from '../components/Header';
import { Button } from '../components/Button';
import { PlaceholderPhoto } from '../components/PlaceholderPhoto';
import { MatchChip } from '../components/MatchChip';
import { ShieldIcon } from '../icons';
import { colors, fonts } from '../theme/tokens';
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

  const { data: detail, isLoading } = useProfileDetail(profileId);
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

  if (isLoading || !detail) {
    return (
      <Screen>
        <Header title="Profile" onBack={() => navigation.goBack()} />
        <View style={styles.loading}>
          <ActivityIndicator color={colors.red} />
        </View>
      </Screen>
    );
  }

  const detailFields = [
    { label: 'Education & profession', value: detail.eduProf },
    { label: 'Family background', value: detail.family },
    { label: 'Height / appearance', value: detail.height },
    { label: 'Marital status', value: detail.marital },
    { label: 'Location', value: detail.city },
    { label: 'About / looking for', value: detail.about },
  ];
  const detailExtraFields = [
    { label: 'Fasting', value: detail.fasting },
    { label: "Qur'an recitation", value: detail.quran },
    { label: 'Hajj / Umrah', value: detail.hajj },
    { label: 'View on polygamy', value: detail.polygamy },
    { label: 'Diet', value: detail.diet },
    { label: 'Smoking', value: detail.smoking },
    { label: 'Habits', value: detail.habits },
    { label: 'Likes', value: detail.likes },
    { label: 'Dislikes', value: detail.dislikes },
  ];

  const guardianNoteText = chaperoneOn
    ? 'Notified automatically once contact is shared.'
    : 'Kept on file; not notified in this mode.';

  // §8.4 — the existing subscribed+accepted gate (`locked`/`lockMessage`, unchanged) now only
  // controls whether "Request Photo" is offered at all; the backend's own "never leak it in the
  // JSON" discipline means `photoUrl` is null unless BOTH that gate and a separately-accepted
  // PhotoAccessRequest are true, so treat "no photoUrl" as locked regardless of the old gate.
  const locked = !!detail.locked;
  const photoUnlocked = !locked && !!detail.photoUrl;
  const photoAccessStatus = detail.photoAccessStatus ?? 'none';

  const onSendInterest = () => {
    sendInterest.mutate(profileId, {
      onError: (err) => {
        if (err instanceof ApiError && err.body?.error === 'subscription_required') {
          navigation.navigate('Pricing', { returnTo: 'detail', pendingInterestProfileId: profileId });
        } else {
          showToast('Could not send interest. Please try again.');
        }
      },
    });
  };

  return (
    <Screen>
      <Header
        title="Profile"
        onBack={() => navigation.goBack()}
        right={<Button title="Block" variant="text" onPress={onBlock} />}
      />
      <ScrollView>
        <View style={styles.photoArea}>
          {photoUnlocked ? (
            <Image source={{ uri: resolvePhotoUrl(detail.photoUrl)! }} style={styles.photoImage} />
          ) : (
            <PlaceholderPhoto
              width="100%"
              height={260}
              locked
              intensity={45}
              iconSize={26}
              lockMessage={detail.lockMessage}
            />
          )}
        </View>

        <View style={styles.body}>
          <View>
            <View style={styles.nameRow}>
              <Text style={styles.name}>
                {detail.name}, {detail.age}
              </Text>
              <MatchChip score={detail.score} size="label" />
            </View>
            <View style={styles.tagRow}>
              {[detail.sect, detail.prayer, detail.modesty].filter(Boolean).map((t, i) => (
                <View key={i} style={styles.tag}>
                  <Text style={styles.tagText}>{t}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* §8.4 — explicit photo consent, on top of (not instead of) the subscribed+accepted
              gate above. "Request Photo" only ever appears once that gate is satisfied. */}
          {!locked && !photoUnlocked ? (
            <View style={styles.photoAccessBox}>
              <Text style={styles.fieldLabel}>Profile photo</Text>
              {photoAccessStatus === 'pending' ? (
                <Text style={[styles.pendingText, { marginTop: 6 }]}>Photo request sent — awaiting response.</Text>
              ) : (
                <>
                  <Text style={[styles.contactNote, { marginTop: 4, marginBottom: 10 }]}>
                    {photoAccessStatus === 'rejected'
                      ? `${detail.name} declined your last request to view their photo.`
                      : `${detail.name}'s photo stays hidden until they approve your request to view it.`}
                  </Text>
                  <Button
                    title={photoAccessStatus === 'rejected' ? 'Request again' : 'Request photo'}
                    variant="outline"
                    onPress={() =>
                      requestPhoto.mutate(undefined, {
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
            <View style={styles.photoAccessBox}>
              <Text style={styles.pendingText}>{detail.name} has requested to view your profile photo.</Text>
              <View style={[styles.actions, { marginTop: 10 }]}>
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

          {detailFields.map((f) => (
            <View key={f.label} style={styles.fieldRow}>
              <Text style={styles.fieldLabel}>{f.label}</Text>
              <Text style={styles.fieldValue}>{f.value || '—'}</Text>
            </View>
          ))}
          {detailExtraFields.map((f) => (
            <View key={f.label} style={styles.fieldRow}>
              <Text style={styles.fieldLabel}>{f.label}</Text>
              <Text style={styles.fieldValue}>{f.value || '—'}</Text>
            </View>
          ))}

          <View style={styles.contactSection}>
            <Text style={styles.fieldLabel}>Contact details</Text>
            {detail.contact ? (
              <>
                <Text style={styles.contactValue}>{detail.contact.phone}</Text>
                <Text style={[styles.contactValue, { marginTop: 2 }]}>{detail.contact.email}</Text>
              </>
            ) : (
              <>
                <Text style={styles.contactBlurred}>+91 •• •••• ••••</Text>
                <Text style={styles.contactNote}>Unlocks after an active subscription and a mutual accepted interest.</Text>
              </>
            )}
          </View>

          <View style={styles.guardianBox}>
            <ShieldIcon />
            <View style={{ flex: 1 }}>
              <Text style={styles.guardianText}>
                Guardian (Wali): <Text style={{ fontFamily: fonts.extraBold }}>{detail.wali}</Text>
              </Text>
              <Text style={styles.guardianNote}>{guardianNoteText}</Text>
            </View>
          </View>

          {detail.interestStatus === 'none' || detail.interestStatus === 'declined' ? (
            <Button title="Send interest" onPress={onSendInterest} loading={sendInterest.isPending} />
          ) : null}
          {detail.interestStatus === 'sent' ? (
            <View style={styles.pendingBox}>
              <Text style={styles.pendingText}>Interest sent — awaiting response</Text>
            </View>
          ) : null}
          {detail.interestStatus === 'accepted' ? (
            <Button
              title="Message"
              onPress={() => navigation.navigate('ChatThread', { userId: profileId, name: detail.name })}
            />
          ) : null}
          {detail.interestStatus === 'received' ? (
            <View style={styles.pendingBox}>
              <Text style={styles.pendingText}>They're interested in you — respond from Requests &gt; Received</Text>
            </View>
          ) : null}
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoArea: {
    height: 260,
    width: '100%',
  },
  photoImage: {
    width: '100%',
    height: '100%',
  },
  body: {
    padding: 20,
    gap: 18,
  },
  nameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  name: {
    fontFamily: fonts.extraBold,
    fontSize: 20,
    color: colors.ink,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  tag: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: colors.surface,
  },
  tagText: {
    fontSize: 11,
    fontFamily: fonts.semiBold,
    color: colors.ink,
  },
  fieldRow: {
    borderTopWidth: 1,
    borderTopColor: colors.borderHairline,
    paddingTop: 10,
  },
  fieldLabel: {
    fontSize: 11,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: colors.muted,
    fontFamily: fonts.regular,
  },
  fieldValue: {
    fontSize: 14,
    marginTop: 4,
    lineHeight: 20,
    color: colors.ink,
    fontFamily: fonts.regular,
  },
  contactSection: {
    borderTopWidth: 1,
    borderTopColor: colors.borderHairline,
    paddingTop: 14,
  },
  contactValue: {
    fontSize: 14,
    color: colors.ink,
    fontFamily: fonts.regular,
    marginTop: 6,
  },
  contactBlurred: {
    fontSize: 14,
    color: colors.ink,
    fontFamily: fonts.regular,
    marginTop: 6,
    opacity: 0.4,
  },
  contactNote: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 6,
    fontFamily: fonts.regular,
  },
  guardianBox: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
    padding: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  guardianText: {
    fontSize: 13,
    color: colors.ink,
    fontFamily: fonts.regular,
  },
  guardianNote: {
    fontSize: 13,
    color: colors.muted,
    marginTop: 2,
    fontFamily: fonts.regular,
  },
  pendingBox: {
    padding: 14,
    backgroundColor: colors.surface,
  },
  pendingText: {
    fontFamily: fonts.extraBold,
    fontSize: 14,
    color: colors.muted,
  },
  photoAccessBox: {
    padding: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  actions: {
    flexDirection: 'row',
    gap: 6,
  },
});
