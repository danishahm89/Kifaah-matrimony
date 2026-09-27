import React, { useState } from 'react';
import { FormCard, StepProgress } from '../components/Onboarding';
import { PhotoPicker } from '../components/PhotoPicker';
import { tr } from '../i18n/t';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import * as ImagePicker from 'expo-image-picker';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Screen } from '../components/Screen';
import { Header } from '../components/Header';
import { Button } from '../components/Button';
import { TextField } from '../components/TextField';
import { FieldLabel } from '../components/FieldLabel';
import { SelectField } from '../components/SelectField';
import { SegmentRow } from '../components/SegmentRow';
import { StripePattern } from '../components/StripePattern';
import { colors, fonts, themedStyles } from '../theme/tokens';
import { useReference } from '../api/hooks/useReference';
import { useAuthStore } from '../store/authStore';
import { useOnboardingStore } from '../store/onboardingStore';
import { useUpdateProfile, useUploadPhoto } from '../api/hooks/useProfile';
import { ApiError } from '../api/client';
import { friendlyProfileError } from '../utils/friendlyProfileError';
import type { RootStackParamList } from '../navigation/types';

const OTHER_SPECIFY = 'Other (specify)';
const OTHER_CITY = 'Other (type below)';


const SUGGESTIONS: Record<'bride' | 'groom', { label: string; text: string }[]> = {
  bride: [
    { label: 'Balanced', text: '' },
    {
      label: 'Family-focused',
      text: "Family means a lot to me. I pray regularly, enjoy cooking and quiet time at home, and I'm looking for a practicing, kind and responsible brother who wants a calm, loving home built on the Sunnah.",
    },
    {
      label: 'Career & deen',
      text: "Alhamdulillah I'm working and keep my deen at the centre of my life. I'm looking for a practicing brother who respects my ambitions and wants us to grow in faith and in life together.",
    },
  ],
  groom: [
    { label: 'Balanced', text: '' },
    {
      label: 'Family-focused',
      text: "I'm a family person who prays regularly and tries to follow the Sunnah at home. I'm looking for a practicing, kind-hearted sister who values family and wants to build a peaceful home together.",
    },
    {
      label: 'Career & deen',
      text: "I'm settled in my career and keep my deen first. I'm looking for a practicing sister with good character who wants a marriage of mutual respect, support and growing closer to Allah together.",
    },
  ],
};

const SUGGEST_ABOUT = {
  bride:
    "I try to balance faith, family and my career. I pray regularly and value modesty. Looking for a practicing brother who is kind, responsible and ready to build a home rooted in Islamic values together.",
  groom:
    "I try to stay grounded in my deen while building my career. I pray regularly and want a marriage based on mutual respect. Looking for a practicing sister who values family and wants to grow together in faith.",
};

SUGGESTIONS.bride[0].text = SUGGEST_ABOUT.bride;
SUGGESTIONS.groom[0].text = SUGGEST_ABOUT.groom;

export function ProfileSetupScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const gender = useAuthStore((s) => s.user?.gender ?? 'bride');
  const { data: ref, isLoading } = useReference();
  const { draft, setField, customCityMode, setCustomCityMode, reset } = useOnboardingStore();
  const updateProfile = useUpdateProfile();
  const uploadPhoto = useUploadPhoto();

  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const pickPhoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      allowsEditing: true,
      aspect: [1, 1],
    });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    setPhotoUri(asset.uri);
    uploadPhoto.mutate(
      {
        uri: asset.uri,
        name: asset.fileName || 'photo.jpg',
        mimeType: asset.mimeType || 'image/jpeg',
      },
      {
        // The server re-validates/re-encodes every upload (CONTRACT.md §7.3) and can reject it
        // (invalid_image, file_too_large) even though it looked fine on-device — don't leave the
        // preview showing a photo that isn't actually saved.
        onError: () => setPhotoUri(null),
      }
    );
  };

  const photoErrorMessage = (() => {
    if (!(uploadPhoto.error instanceof ApiError)) return null;
    switch (uploadPhoto.error.body?.error) {
      case 'file_too_large':
        return 'That photo is too large — please choose a smaller one.';
      case 'invalid_image':
        return "That file couldn't be used as a photo — please choose a JPEG, PNG or WEBP image.";
      default:
        return 'Could not upload that photo. Please try again.';
    }
  })();

  const onEduProfChange = (v: string) => {
    setField('eduProf', v);
    setField('profField', v);
  };

  const onCityChange = (v: string) => {
    if (v === OTHER_CITY) {
      setCustomCityMode(true);
      setField('city', '');
      return;
    }
    setCustomCityMode(false);
    setField('city', v);
  };

  const finish = async () => {
    setSubmitError(null);

    // Client-side check before hitting the network: `name` is the one field this
    // screen owns that the backend requires non-empty (CONTRACT §4). Catching it
    // here avoids a round trip and a cryptic "invalid_input" from the server.
    if (!draft.name || !draft.name.trim()) {
      setSubmitError('Please enter your name.');
      return;
    }

    try {
      await updateProfile.mutateAsync(draft);
      reset();
      // No explicit navigation call needed: RootNavigator swaps to the Main stack once
      // `wali` is present on the refetched profile (see useMe invalidation in useUpdateProfile).
    } catch (e: any) {
      setSubmitError(friendlyProfileError(e));
    }
  };

  if (isLoading || !ref) {
    return (
      <Screen>
        <Header title={tr("Your profile")} onBack={() => navigation.navigate('ShariahQA')} />
        <View style={styles.loading}>
          <ActivityIndicator color={colors.red} />
        </View>
      </Screen>
    );
  }

  const asOptions = (list: string[]) => list.map((v) => ({ label: v, value: v }));

  return (
    <Screen>
      <Header title={tr("Your profile")} onBack={() => navigation.navigate('ShariahQA')} />
      <KeyboardAwareScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        enableOnAndroid
        extraScrollHeight={24}
        keyboardOpeningTime={0}
      >
        <StepProgress step={2} total={2} label="About you" />

        <FormCard icon="📷" title="Profile photo" hint="Optional, but it helps">
          <PhotoPicker
            gender={gender}
            uri={photoUri}
            uploading={uploadPhoto.isPending}
            error={photoErrorMessage}
            onPick={pickPhoto}
          />
        </FormCard>

        <FormCard icon="👤" title="The basics">
          <View style={styles.sideBySide}>
            <View style={styles.flex1}>
              <FieldLabel>{tr("Full name")}</FieldLabel>
              <TextField value={draft.name ?? ''} onChangeText={(v) => setField('name', v)} placeholder={tr("As shown to other members")} />
            </View>
            <View style={styles.flex1}>
              <FieldLabel>{tr("Age")}</FieldLabel>
              <TextField
                value={draft.age != null ? String(draft.age) : ''}
                onChangeText={(v) => setField('age', v.replace(/[^0-9]/g, '') ? Number(v.replace(/[^0-9]/g, '')) : undefined)}
                placeholder="27"
                keyboardType="number-pad"
                maxLength={2}
              />
            </View>
          </View>
          <View style={styles.sideBySide}>
            <View style={styles.flex1}>
              <FieldLabel>{tr("Height")}</FieldLabel>
              <SelectField title="Height" value={draft.height ?? ''} options={ref.heights} onChange={(v) => setField('height', v)} />
            </View>
            <View style={styles.flex1}>
              <FieldLabel>{tr("Location / city")}</FieldLabel>
              <SelectField title="Location / city" searchable value={customCityMode ? OTHER_CITY : draft.city ?? ''} options={[...ref.cities, OTHER_CITY]} onChange={onCityChange} />
              {customCityMode ? (
                <TextField
                  value={draft.city ?? ''}
                  onChangeText={(v) => setField('city', v)}
                  placeholder={tr("Type your city")}
                  style={{ marginTop: 8 }}
                />
              ) : null}
            </View>
          </View>
          <View>
            <FieldLabel>{tr("Marital status")}</FieldLabel>
            <SegmentRow options={asOptions(ref.maritalOptions)} value={draft.marital ?? ''} onChange={(v) => setField('marital', v)} />
          </View>
        </FormCard>

        <FormCard icon="🎓" title="Education & family">
          <View>
            <FieldLabel>{tr("Education & profession")}</FieldLabel>
            <SelectField title="Education & profession" value={draft.eduProf ?? ''} options={ref.eduProfOptions} onChange={onEduProfChange} />
          </View>
          <View>
            <FieldLabel>{tr("Family background")}</FieldLabel>
            <TextField
              value={draft.family ?? ''}
              onChangeText={(v) => setField('family', v)}
              placeholder={tr("e.g. Middle-class, one married sister")}
            />
          </View>
        </FormCard>

        <FormCard icon="🌿" title="Lifestyle & habits">
          <View>
            <FieldLabel>{tr("Diet")}</FieldLabel>
            <SelectField title="Diet" value={draft.diet ?? ''} options={ref.dietOptions} onChange={(v) => setField('diet', v)} />
            {draft.diet === OTHER_SPECIFY ? (
              <TextField
                value={draft.dietCustom ?? ''}
                onChangeText={(v) => setField('dietCustom', v)}
                placeholder={tr("Describe your diet")}
                style={{ marginTop: 8 }}
              />
            ) : null}
          </View>
          <View>
            <FieldLabel>{tr("Smoking")}</FieldLabel>
            <SegmentRow options={asOptions(ref.smokingOptions)} value={draft.smoking ?? ''} onChange={(v) => setField('smoking', v)} />
          </View>
          <View>
            <FieldLabel>{tr("Habits")}</FieldLabel>
            <SelectField title="Habits" value={draft.habits ?? ''} options={ref.habitsOptions} onChange={(v) => setField('habits', v)} />
            {draft.habits === OTHER_SPECIFY ? (
              <TextField
                value={draft.habitsCustom ?? ''}
                onChangeText={(v) => setField('habitsCustom', v)}
                placeholder={tr("Describe your habits")}
                style={{ marginTop: 8 }}
              />
            ) : null}
          </View>
          <View style={styles.sideBySide}>
            <View style={styles.flex1}>
              <FieldLabel>{tr("Likes")}</FieldLabel>
              <SelectField title="Likes" value={draft.likes ?? ''} options={ref.likesOptions} onChange={(v) => setField('likes', v)} />
            {draft.likes === OTHER_SPECIFY ? (
              <TextField
                value={draft.likesCustom ?? ''}
                onChangeText={(v) => setField('likesCustom', v)}
                placeholder={tr("Describe what you like")}
                style={{ marginTop: 8 }}
              />
            ) : null}
            </View>
            <View style={styles.flex1}>
              <FieldLabel>{tr("Dislikes")}</FieldLabel>
              <SelectField title="Dislikes" value={draft.dislikes ?? ''} options={ref.dislikesOptions} onChange={(v) => setField('dislikes', v)} />
            {draft.dislikes === OTHER_SPECIFY ? (
              <TextField
                value={draft.dislikesCustom ?? ''}
                onChangeText={(v) => setField('dislikesCustom', v)}
                placeholder={tr("Describe your dislikes")}
                style={{ marginTop: 8 }}
              />
            ) : null}
            </View>
          </View>
        </FormCard>

        <FormCard icon="✍️" title="About me / what I'm looking for" hint="Tap a suggestion to start, then make it yours">
          <View style={styles.suggestRow}>
            {SUGGESTIONS[gender].map((sug) => (
              <Pressable
                key={sug.label}
                onPress={() => setField('about', sug.text)}
                style={({ hovered }: any) => [styles.suggestChip, hovered && styles.suggestChipHover]}
              >
                <Text style={styles.suggestText}>✨ {tr(sug.label)}</Text>
              </Pressable>
            ))}
          </View>
          <TextField
            value={draft.about ?? ''}
            onChangeText={(v) => setField('about', v)}
            placeholder={tr("A few lines about you and what you're looking for in a partner.")}
            multiline
            numberOfLines={5}
            maxLength={600}
          />
          <Text style={styles.counter}>{(draft.about ?? '').length}/600</Text>
        </FormCard>

        {submitError ? <Text style={styles.error}>{submitError}</Text> : null}
          <Button title={tr("Enter Kifaah")} onPress={finish} loading={updateProfile.isPending} style={styles.finishBtn} />
      </KeyboardAwareScrollView>
    </Screen>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  suggestRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  suggestChip: {
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 18,
    backgroundColor: colors.lowBg,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  suggestChipHover: { backgroundColor: colors.greenBg, borderColor: colors.primary },
  suggestText: { fontFamily: fonts.semiBold, fontSize: 12, color: colors.ink },
  counter: { alignSelf: 'flex-end', fontFamily: fonts.regular, fontSize: 11, color: colors.muted },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    padding: 20,
    paddingBottom: 32,
    gap: 18,
  },
  photoBox: {
    height: 140,
    width: 140,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    overflow: 'hidden',
    position: 'relative',
  },
  photoImage: {
    width: '100%',
    height: '100%',
  },
  photoOverlay: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoText: {
    fontSize: 9,
    letterSpacing: 1,
    color: colors.muted,
    textAlign: 'center',
    fontFamily: fonts.regular,
  },
  photoNote: {
    fontSize: 11,
    color: colors.muted,
    marginTop: 6,
    maxWidth: 260,
    fontFamily: fonts.regular,
  },
  sideBySide: {
    flexDirection: 'row',
    gap: 12,
  },
  flex1: {
    flex: 1,
  },
  sectionDivider: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 16,
  },
  sectionLabel: {
    fontSize: 11,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.muted,
    fontFamily: fonts.regular,
  },
  aboutHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  error: {
    fontFamily: fonts.semiBold,
    fontSize: 12,
    color: colors.redDark,
  },
  finishBtn: {
    marginTop: 8,
  },
}));
