import React, { useRef, useState } from 'react';
import {
  Animated,
  Modal,
  FlatList,
  TouchableOpacity,
  Text,
  View,
  TextInput,
  StyleSheet,
  Platform,
  Pressable,
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { Screen } from '../components/Screen';
import { Header } from '../components/Header';
import { Button } from '../components/Button';
import { FieldLabel } from '../components/FieldLabel';
import { colors, fonts } from '../theme/tokens';
import { useSendOtp, useVerifyOtp } from '../api/hooks/useAuth';
import { ApiError } from '../api/client';
import type { Gender } from '../types';
import { useTheme } from '../theme/ThemeContext';
import { KifaahLogo } from '../components/KifaahLogo';

type Mode = 'pick' | 'auth';
type AuthMode = 'signup' | 'login';

const COUNTRIES = [
  { name: 'India', code: '+91', flag: '🇮🇳' },
  { name: 'Pakistan', code: '+92', flag: '🇵🇰' },
  { name: 'Bangladesh', code: '+880', flag: '🇧🇩' },
  { name: 'Saudi Arabia', code: '+966', flag: '🇸🇦' },
  { name: 'United Arab Emirates', code: '+971', flag: '🇦🇪' },
  { name: 'United Kingdom', code: '+44', flag: '🇬🇧' },
  { name: 'United States', code: '+1', flag: '🇺🇸' },
  { name: 'Canada', code: '+1', flag: '🇨🇦' },
  { name: 'Australia', code: '+61', flag: '🇦🇺' },
  { name: 'Malaysia', code: '+60', flag: '🇲🇾' },
  { name: 'Indonesia', code: '+62', flag: '🇮🇩' },
  { name: 'Turkey', code: '+90', flag: '🇹🇷' },
  { name: 'Egypt', code: '+20', flag: '🇪🇬' },
  { name: 'Qatar', code: '+974', flag: '🇶🇦' },
  { name: 'Kuwait', code: '+965', flag: '🇰🇼' },
  { name: 'Bahrain', code: '+973', flag: '🇧🇭' },
  { name: 'Oman', code: '+968', flag: '🇴🇲' },
  { name: 'Jordan', code: '+962', flag: '🇯🇴' },
  { name: 'Morocco', code: '+212', flag: '🇲🇦' },
  { name: 'Tunisia', code: '+216', flag: '🇹🇳' },
  { name: 'Germany', code: '+49', flag: '🇩🇪' },
  { name: 'France', code: '+33', flag: '🇫🇷' },
  { name: 'Netherlands', code: '+31', flag: '🇳🇱' },
  { name: 'Sweden', code: '+46', flag: '🇸🇪' },
  { name: 'Norway', code: '+47', flag: '🇳🇴' },
  { name: 'Denmark', code: '+45', flag: '🇩🇰' },
  { name: 'South Africa', code: '+27', flag: '🇿🇦' },
  { name: 'Nigeria', code: '+234', flag: '🇳🇬' },
  { name: 'Ghana', code: '+233', flag: '🇬🇭' },
  { name: 'Singapore', code: '+65', flag: '🇸🇬' },
];

function authErrorMessage(err: unknown): string | null {
  if (!(err instanceof ApiError)) return null;
  switch (err.body?.error) {
    case 'invalid_code':
      return 'That code didn\'t match. Please try again.';
    case 'rate_limited':
      return 'Too many attempts — please wait a few minutes and try again.';
    case 'invalid_input':
      return 'Please check the number and try again.';
    case 'gender_required':
      return "We couldn't find an account with that number.";
    default:
      return err.message;
  }
}

export function WelcomeScreen() {
  const { colors: themeColors, mode, toggle } = useTheme();
  const [screenMode, setScreenMode] = useState<Mode>('pick');
  const fadeAnim = useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
  }, [fadeAnim]);

  const [authMode, setAuthMode] = useState<AuthMode>('signup');
  const [gender, setGender] = useState<Gender | null>(null);
  const [selectedCountry, setSelectedCountry] = useState(COUNTRIES[0]);
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [countrySearch, setCountrySearch] = useState('');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const sendOtp = useSendOtp();
  const verifyOtp = useVerifyOtp();
  const pending = sendOtp.isPending || verifyOtp.isPending;
  const errorMsg = authErrorMessage(sendOtp.error) ?? authErrorMessage(verifyOtp.error);

  const resetAuthForm = () => {
    setPhone('');
    setCode('');
    setOtpSent(false);
    sendOtp.reset();
    verifyOtp.reset();
  };

  const pick = (g: Gender) => {
    setGender(g);
    setAuthMode('signup');
    setNotice(null);
    resetAuthForm();
    setScreenMode('auth');
  };

  const startLogin = () => {
    setGender(null);
    setAuthMode('login');
    setNotice(null);
    resetAuthForm();
    setScreenMode('auth');
  };

  const goBack = () => {
    setScreenMode('pick');
    setNotice(null);
    resetAuthForm();
  };

  const fullPhone = selectedCountry.code + phone.trim();

  const submitPhone = () => {
    sendOtp.mutate(fullPhone, { onSuccess: () => setOtpSent(true) });
  };

  const submitCode = () => {
    verifyOtp.mutate(
      { phone: fullPhone, code: code.trim(), ...(authMode === 'signup' && gender ? { gender } : {}) },
      {
        onError: (err) => {
          if (err instanceof ApiError && err.body?.error === 'gender_required') {
            resetAuthForm();
            setScreenMode('pick');
            setNotice("We couldn't find an account with that number — choose \"I am a...\" below to sign up.");
          }
        },
      }
    );
  };

  const filteredCountries = COUNTRIES.filter(c =>
    c.name.toLowerCase().includes(countrySearch.toLowerCase()) ||
    c.code.includes(countrySearch)
  );

  const headerTitle = otpSent ? 'Enter code' : authMode === 'signup' ? 'Verify your number' : 'Log in';

  const isDark = mode === 'dark';

  return (
    <Screen>
      {/* Dark/Light toggle */}
      <Pressable
        style={[styles.themeToggle, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}
        onPress={toggle}
      >
        <Text style={{ fontSize: 18 }}>{isDark ? '☀️' : '🌙'}</Text>
      </Pressable>

      {screenMode === 'auth' ? <Header title={headerTitle} onBack={goBack} /> : null}

      <KeyboardAwareScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        enableOnAndroid
        extraScrollHeight={24}
        keyboardOpeningTime={0}
      >
        {screenMode === 'pick' ? (
          <>
            <Animated.View style={[styles.brandBand, { opacity: fadeAnim }]}>
              {/* Logo */}
              <View style={styles.logoWrap}>
                <KifaahLogo size={88} />
              </View>
              <Text style={[styles.brand, { color: themeColors.ink }]}>KIFAAH</Text>
              <View style={[styles.rule, { backgroundColor: themeColors.accent }]} />
              <Text style={[styles.eyebrow, { color: themeColors.primary }]}>
                ISLAMIC MATRIMONY · SHARIAH-GUIDED
              </Text>
              <Text style={[styles.intro, { color: themeColors.muted }]}>
                Find your ideal match through a platform built on Islamic values
                — Shariah-guided, guardian-aware, and privacy-first.
              </Text>
              <View style={styles.featurePills}>
                {['Shariah-Guided', 'Privacy-First', 'Wali System', 'Serious Matches'].map(lbl => (
                  <View key={lbl} style={[styles.pill, { backgroundColor: themeColors.greenBg, borderColor: themeColors.border }]}>
                    <Text style={[styles.pillText, { color: themeColors.primary }]}>{lbl}</Text>
                  </View>
                ))}
              </View>
            </Animated.View>

            {notice ? <Text style={[styles.error, { color: themeColors.red }]}>{notice}</Text> : null}

            <Text style={[styles.pickLabel, { color: themeColors.muted }]}>I AM A</Text>

              <Pressable
                style={[styles.roleCard, { backgroundColor: themeColors.bgCard, borderColor: themeColors.border, shadowColor: themeColors.shadow }]}
                onPress={() => pick('groom')}
              >
                <View style={[styles.roleIconCircle, { backgroundColor: themeColors.greenBg }]}>
                  <Text style={styles.roleEmoji}>🧔</Text>
                </View>
                <View style={styles.roleInfo}>
                  <Text style={[styles.roleTitle, { color: themeColors.ink }]}>I am a Brother</Text>
                  <Text style={[styles.roleSubtitle, { color: themeColors.muted }]}>Looking for a righteous sister</Text>
                  <View style={styles.roleTags}>
                    <View style={[styles.roleTag, { backgroundColor: themeColors.greenBg }]}>
                    <Text style={[styles.roleTagText, { color: themeColors.primary }]}>Serious Intent</Text>
                    </View>
                    <View style={[styles.roleTag, { backgroundColor: themeColors.greenBg }]}>
                    <Text style={[styles.roleTagText, { color: themeColors.primary }]}>Wali Approved</Text>
                    </View>
                  </View>
                </View>
                <View style={[styles.roleArrowCircle, { backgroundColor: themeColors.primary }]}>
                  <Text style={styles.roleArrowText}>›</Text>
                </View>
              </Pressable>

              <Pressable
                style={[styles.roleCard, { backgroundColor: themeColors.bgCard, borderColor: themeColors.border, shadowColor: themeColors.shadow }]}
                onPress={() => pick('bride')}
              >
                <View style={[styles.roleIconCircle, { backgroundColor: '#fdf5e0' }]}>
                  <Text style={styles.roleEmoji}>🧕</Text>
                </View>
                <View style={styles.roleInfo}>
                  <Text style={[styles.roleTitle, { color: themeColors.ink }]}>I am a Sister</Text>
                  <Text style={[styles.roleSubtitle, { color: themeColors.muted }]}>Looking for a righteous brother</Text>
                  <View style={styles.roleTags}>
                    <View style={[styles.roleTag, { backgroundColor: '#fdf5e0' }]}>
                    <Text style={[styles.roleTagText, { color: themeColors.accent }]}>Guardian Aware</Text>
                    </View>
                    <View style={[styles.roleTag, { backgroundColor: '#fdf5e0' }]}>
                    <Text style={[styles.roleTagText, { color: themeColors.accent }]}>Blurred Photos</Text>
                    </View>
                  </View>
                </View>
                <View style={[styles.roleArrowCircle, { backgroundColor: themeColors.accent }]}>
                  <Text style={styles.roleArrowText}>›</Text>
                </View>
              </Pressable>

            <Button
              title="Already have an account? Log in"
              variant="text"
              onPress={startLogin}
            />
          </>
        ) : !otpSent ? (
          <View style={styles.authForm}>
            <Text style={[styles.authHint, { color: themeColors.muted }]}>
              Enter your mobile number to continue.
              We'll send a 6-digit verification code.
            </Text>

            {/* Country picker */}
            <View style={styles.fieldWrap}>
              <Text style={[styles.fieldLabel, { color: themeColors.muted }]}>COUNTRY</Text>
              <Pressable
                style={[styles.countryBtn, { backgroundColor: themeColors.inputBg, borderColor: themeColors.borderStrong }]}
                onPress={() => setShowCountryPicker(true)}
              >
                <Text style={styles.countryFlag}>{selectedCountry.flag}</Text>
                <Text style={[styles.countryName, { color: themeColors.ink }]}>
                  {selectedCountry.name}
                </Text>
                <Text style={[styles.countryCode, { color: themeColors.primary }]}>
                  {selectedCountry.code}
                </Text>
                <Text style={[styles.countryArrow, { color: themeColors.muted }]}>▾</Text>
              </Pressable>
            </View>

            {/* Phone number input */}
            <View style={styles.fieldWrap}>
              <Text style={[styles.fieldLabel, { color: themeColors.muted }]}>MOBILE NUMBER</Text>
              <View style={[styles.phoneRow, { backgroundColor: themeColors.inputBg, borderColor: themeColors.borderStrong }]}>
                <Text style={[styles.phonePrefix, { color: themeColors.primary }]}>
                  {selectedCountry.code}
                </Text>
                <TextInput
                  style={[styles.phoneInput, { color: themeColors.ink }]}
                  value={phone}
                  onChangeText={(t) => {
                    const digits = t.replace(/\D/g, '').slice(0, 10);
                    setPhone(digits);
                  }}
                  placeholder="10-digit number"
                  placeholderTextColor={themeColors.subtle}
                  autoCapitalize="none"
                  keyboardType="phone-pad"
                  autoComplete="tel"
                  textContentType="telephoneNumber"
                  maxLength={10}
                />
                <Text style={[styles.phoneCount, { color: themeColors.subtle }]}>
                  {phone.length}/10
                </Text>
              </View>
            </View>

            {errorMsg ? <Text style={[styles.error, { color: themeColors.red }]}>{errorMsg}</Text> : null}

            <Button
              title="Send code"
              onPress={submitPhone}
              loading={pending}
              disabled={phone.trim().length !== 10}
            />
          </View>
        ) : (
          <View style={styles.authForm}>
            <Text style={[styles.authHint, { color: themeColors.muted }]}>
              Enter the code sent to {selectedCountry.code + phone.trim()}.
            </Text>
            <View style={styles.fieldWrap}>
              <Text style={[styles.fieldLabel, { color: themeColors.muted }]}>6-DIGIT CODE</Text>
              <TextInput
                style={[styles.codeInput, { color: themeColors.ink, backgroundColor: themeColors.inputBg, borderColor: themeColors.borderStrong }]}
                value={code}
                onChangeText={setCode}
                placeholder="123456"
                placeholderTextColor={themeColors.subtle}
                keyboardType="number-pad"
                autoComplete="one-time-code"
                textContentType="oneTimeCode"
                maxLength={6}
              />
            </View>
            {errorMsg ? <Text style={[styles.error, { color: themeColors.red }]}>{errorMsg}</Text> : null}
            <Button title="Verify" onPress={submitCode} loading={pending} disabled={code.trim().length !== 6} />
            <Button
              title="Resend code"
              variant="text"
              onPress={() => sendOtp.mutate(fullPhone)}
              disabled={pending}
            />
          </View>
        )}
      </KeyboardAwareScrollView>

      {/* Country Picker Modal */}
      <Modal visible={showCountryPicker} animationType="slide" presentationStyle="pageSheet">
        <View style={[styles.modalWrap, { backgroundColor: themeColors.bg }]}>
          <View style={[styles.modalHeader, { borderBottomColor: themeColors.border }]}>
            <Text style={[styles.modalTitle, { color: themeColors.ink }]}>Select Country</Text>
            <Pressable onPress={() => { setShowCountryPicker(false); setCountrySearch(''); }}>
              <Text style={[styles.modalClose, { color: themeColors.primary }]}>Done</Text>
            </Pressable>
          </View>
          <TextInput
            style={[styles.searchInput, { color: themeColors.ink, backgroundColor: themeColors.inputBg, borderColor: themeColors.border }]}
            value={countrySearch}
            onChangeText={setCountrySearch}
            placeholder="Search country..."
            placeholderTextColor={themeColors.subtle}
          />
          <FlatList
            data={filteredCountries}
            keyExtractor={(item) => item.name + item.code}
            renderItem={({ item }) => (
              <Pressable
                style={[
                  styles.countryItem,
                  { borderBottomColor: themeColors.border },
                  selectedCountry.name === item.name && selectedCountry.code === item.code
                    ? { backgroundColor: themeColors.greenBg }
                    : {},
                ]}
                onPress={() => {
                  setSelectedCountry(item);
                  setShowCountryPicker(false);
                  setCountrySearch('');
                }}
              >
                <Text style={styles.countryFlag}>{item.flag}</Text>
                <Text style={[styles.countryItemName, { color: themeColors.ink }]}>{item.name}</Text>
                <Text style={[styles.countryItemCode, { color: themeColors.primary }]}>{item.code}</Text>
              </Pressable>
            )}
          />
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 24, paddingTop: 20, paddingBottom: 48, flexGrow: 1 },
  themeToggle: {
    position: 'absolute', top: Platform.OS === 'ios' ? 52 : 12, right: 16,
    zIndex: 100, width: 38, height: 38, borderRadius: 19,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, elevation: 3, shadowOpacity: 0.1, shadowRadius: 4, shadowOffset: { width: 0, height: 2 },
  },
  brandBand: { marginBottom: 32 },
  logoWrap: { alignItems: 'center', marginBottom: 16, marginTop: 8 },
  brand: { fontFamily: fonts.extraBold, fontSize: 32, letterSpacing: -0.5 },
  rule: { height: 2, width: 56, marginTop: 6, marginBottom: 8 },
  eyebrow: { fontFamily: fonts.regular, fontSize: 11, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 12 },
  intro: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 22 },
  pickLabel: { fontFamily: fonts.semiBold, fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 12 },
  roleCard: {
    flexDirection: 'row', alignItems: 'center', padding: 16, marginBottom: 12,
    borderRadius: 12, borderWidth: 1.5,
    shadowOpacity: 0.08, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 3,
  },
  roleEmoji: { fontSize: 28, marginRight: 14 },
  roleTitle: { fontFamily: fonts.semiBold, fontSize: 17 },
  roleSubtitle: { fontFamily: fonts.regular, fontSize: 13, marginTop: 2 },
  roleArrow: { marginLeft: 'auto', fontSize: 24, fontWeight: '300' },
  authForm: { gap: 16 },
  authHint: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 22, marginBottom: 4 },
  fieldWrap: { gap: 6 },
  fieldLabel: { fontFamily: fonts.semiBold, fontSize: 10, letterSpacing: 1.2, textTransform: 'uppercase' },
  countryBtn: {
    flexDirection: 'row', alignItems: 'center', minHeight: 48,
    paddingHorizontal: 12, borderRadius: 10, borderWidth: 1.5,
  },
  countryFlag: { fontSize: 22, marginRight: 10 },
  countryName: { fontFamily: fonts.regular, fontSize: 15, flex: 1 },
  countryCode: { fontFamily: fonts.semiBold, fontSize: 15, marginRight: 6 },
  countryArrow: { fontSize: 14 },
  phoneRow: {
    flexDirection: 'row', alignItems: 'center', minHeight: 48,
    paddingHorizontal: 12, borderRadius: 10, borderWidth: 1.5,
  },
  phonePrefix: { fontFamily: fonts.semiBold, fontSize: 16, marginRight: 8, lineHeight: 20 },
  phoneInput: { flex: 1, fontFamily: fonts.regular, fontSize: 16, paddingVertical: 10, paddingHorizontal: 12, lineHeight: 20 },
  phoneCount: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 20, marginLeft: 6 },
  codeInput: {
    minHeight: 48, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1.5,
    fontFamily: fonts.regular, fontSize: 20, letterSpacing: 6, textAlign: 'center',
  },
  error: { fontFamily: fonts.semiBold, fontSize: 13 },
  modalWrap: { flex: 1 },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 16, borderBottomWidth: 1,
  },
  modalTitle: { fontFamily: fonts.semiBold, fontSize: 18 },
  modalClose: { fontFamily: fonts.semiBold, fontSize: 16 },
  searchInput: {
    margin: 12, paddingHorizontal: 12, paddingVertical: 10,
    borderRadius: 8, borderWidth: 1, fontFamily: fonts.regular, fontSize: 15,
  },
  countryItem: {
    flexDirection: 'row', alignItems: 'center', padding: 14,
    paddingHorizontal: 16, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  countryItemName: { fontFamily: fonts.regular, fontSize: 15, flex: 1, marginLeft: 4 },
  countryItemCode: { fontFamily: fonts.semiBold, fontSize: 14 },
  featurePills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 16,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    gap: 4,
  },
  pillIcon: { fontSize: 13 },
  pillText: { fontFamily: fonts.semiBold, fontSize: 11, letterSpacing: 0.3 },
  roleIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleInfo: { flex: 1 },
  roleTags: { flexDirection: 'row', gap: 6, marginTop: 6 },
  roleTag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  roleTagText: { fontFamily: fonts.semiBold, fontSize: 10, letterSpacing: 0.2 },
  roleArrowCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleArrowText: { color: '#ffffff', fontSize: 20, lineHeight: 28, fontWeight: '600' },
});
