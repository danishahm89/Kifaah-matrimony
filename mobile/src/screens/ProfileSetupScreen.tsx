import React, { useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
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
import { colors, fonts } from '../theme/tokens';
import { useReference } from '../api/hooks/useReference';
import { useAuthStore } from '../store/authStore';
import { useOnboardingStore } from '../store/onboardingStore';
import { useUpdateProfile, useUploadPhoto } from '../api/hooks/useProfile';
import { ApiError } from '../api/client';
import type { RootStackParamList } from '../navigation/types';

const OTHER_SPECIFY = 'Other (specify)';
const OTHER_CITY = 'Other (type below)';

const SUGGEST_ABOUT = {
  bride:
    "I try to balance faith, family and my career. I pray regularly and value modesty. Looking for a practicing brother who is kind, responsible and ready to build a home rooted in Islamic values together.",
  groom:
    "I try to stay grounded in my deen while building my career. I pray regularly and want a marriage based on mutual respect. Looking for a practicing sister who values family and wants to grow together in faith.",
};

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
    try {
      await updateProfile.mutateAsync(draft);
      reset();
      // No explicit navigation call needed: RootNavigator swaps to the Main stack once
      // `wali` is present on the refetched profile (see useMe invalidation in useUpdateProfile).
    } catch (e: any) {
      setSubmitError(e?.message || 'Could not save your profile. Please try again.');
    }
  };

  if (isLoading || !ref) {
    return (
      <Screen>
        <Header title="Your profile" onBack={() => navigation.navigate('ShariahQA')} />
        <View style={styles.loading}>
          <ActivityIndicator color={colors.red} />
        </View>
      </Screen>
    );
  }

  const asOptions = (list: string[]) => list.map((v) => ({ label: v, value: v }));

  return (
    <Screen>
      <Header title="Your profile" onBack={() => navigation.navigate('ShariahQA')} />
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.sideBySide}>
          <View style={styles.flex1}>
            <FieldLabel>Full name</FieldLabel>
            <TextField value={draft.name ?? ''} onChangeText={(v) => setField('name', v)} placeholder="As shown to other members" />
          </View>
          <View style={styles.flex1}>
            <FieldLabel>Age</FieldLabel>
            <TextField
              value={draft.age != null ? String(draft.age) : ''}
              onChangeText={(v) => setField('age', v.replace(/[^0-9]/g, '') ? Number(v.replace(/[^0-9]/g, '')) : undefined)}
              placeholder="e.g. 27"
              keyboardType="number-pad"
            />
          </View>
        </View>

        <View>
          <FieldLabel>Photo</FieldLabel>
          <Pressable style={styles.photoBox} onPress={pickPhoto}>
            {photoUri ? (
              <Image source={{ uri: photoUri }} style={styles.photoImage} />
            ) : (
              <>
                <StripePattern />
                <View style={styles.photoOverlay}>
                  <Text style={styles.photoText}>DROP{'\n'}PHOTO</Text>
                </View>
              </>
            )}
            {uploadPhoto.isPending ? (
              <View style={styles.photoOverlay}>
                <ActivityIndicator color={colors.ink} />
              </View>
            ) : null}
          </Pressable>
          <Text style={styles.photoNote}>Stays blurred to everyone else until they subscribe and you accept their interest.</Text>
          {photoErrorMessage ? <Text style={styles.error}>{photoErrorMessage}</Text> : null}
        </View>

        <View>
          <FieldLabel>Education &amp; profession</FieldLabel>
          <SelectField value={draft.eduProf ?? ''} options={ref.eduProfOptions} onChange={onEduProfChange} />
        </View>

        <View>
          <FieldLabel>Family background</FieldLabel>
          <TextField
            value={draft.family ?? ''}
            onChangeText={(v) => setField('family', v)}
            placeholder="e.g. Middle-class, one married sister"
          />
        </View>

        <View style={styles.sideBySide}>
          <View style={styles.flex1}>
            <FieldLabel>Height</FieldLabel>
            <SelectField value={draft.height ?? ''} options={ref.heights} onChange={(v) => setField('height', v)} />
          </View>
          <View style={styles.flex1}>
            <FieldLabel>Location / city</FieldLabel>
            <SelectField value={draft.city ?? ''} options={[...ref.cities, OTHER_CITY]} onChange={onCityChange} />
            {customCityMode ? (
              <TextField
                value={draft.city ?? ''}
                onChangeText={(v) => setField('city', v)}
                placeholder="Type your city"
                style={{ marginTop: 8 }}
              />
            ) : null}
          </View>
        </View>

        <View>
          <FieldLabel>Marital status</FieldLabel>
          <SegmentRow options={asOptions(ref.maritalOptions)} value={draft.marital ?? ''} onChange={(v) => setField('marital', v)} />
        </View>

        <View style={styles.sectionDivider}>
          <Text style={styles.sectionLabel}>Lifestyle &amp; habits</Text>
        </View>

        <View>
          <FieldLabel>Diet</FieldLabel>
          <SelectField value={draft.diet ?? ''} options={ref.dietOptions} onChange={(v) => setField('diet', v)} />
          {draft.diet === OTHER_SPECIFY ? (
            <TextField
              value={draft.dietCustom ?? ''}
              onChangeText={(v) => setField('dietCustom', v)}
              placeholder="Describe your diet"
              style={{ marginTop: 8 }}
            />
          ) : null}
        </View>

        <View>
          <FieldLabel>Smoking</FieldLabel>
          <SegmentRow options={asOptions(ref.smokingOptions)} value={draft.smoking ?? ''} onChange={(v) => setField('smoking', v)} />
        </View>

        <View>
          <FieldLabel>Habits</FieldLabel>
          <SelectField value={draft.habits ?? ''} options={ref.habitsOptions} onChange={(v) => setField('habits', v)} />
          {draft.habits === OTHER_SPECIFY ? (
            <TextField
              value={draft.habitsCustom ?? ''}
              onChangeText={(v) => setField('habitsCustom', v)}
              placeholder="Describe your habits"
              style={{ marginTop: 8 }}
            />
          ) : null}
        </View>

        <View>
          <FieldLabel>Likes</FieldLabel>
          <SelectField value={draft.likes ?? ''} options={ref.likesOptions} onChange={(v) => setField('likes', v)} />
          {draft.likes === OTHER_SPECIFY ? (
            <TextField
              value={draft.likesCustom ?? ''}
              onChangeText={(v) => setField('likesCustom', v)}
              placeholder="Describe what you like"
              style={{ marginTop: 8 }}
            />
          ) : null}
        </View>

        <View>
          <FieldLabel>Dislikes</FieldLabel>
          <SelectField value={draft.dislikes ?? ''} options={ref.dislikesOptions} onChange={(v) => setField('dislikes', v)} />
          {draft.dislikes === OTHER_SPECIFY ? (
            <TextField
              value={draft.dislikesCustom ?? ''}
              onChangeText={(v) => setField('dislikesCustom', v)}
              placeholder="Describe your dislikes"
              style={{ marginTop: 8 }}
            />
          ) : null}
        </View>

        <View>
          <View style={styles.aboutHeader}>
            <FieldLabel>About me / what I'm looking for</FieldLabel>
            <Button
              title="Suggest for me"
              variant="text"
              onPress={() => setField('about', SUGGEST_ABOUT[gender])}
            />
          </View>
          <TextField
            value={draft.about ?? ''}
            onChangeText={(v) => setField('about', v)}
            placeholder="A few lines about you and what you're looking for in a partner."
            multiline
            numberOfLines={4}
          />
        </View>

        {submitError ? <Text style={styles.error}>{submitError}</Text> : null}
        <Button title="Enter Kifaah" onPress={finish} loading={updateProfile.isPending} style={styles.finishBtn} />
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
});
