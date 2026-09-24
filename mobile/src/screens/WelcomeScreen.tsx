import React, { useEffect, useRef, useState } from 'react';
import { Animated, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Screen } from '../components/Screen';
import { Header } from '../components/Header';
import { Button } from '../components/Button';
import { TextField } from '../components/TextField';
import { FieldLabel } from '../components/FieldLabel';
import { colors, fonts } from '../theme/tokens';
import { useSendOtp, useVerifyOtp } from '../api/hooks/useAuth';
import { ApiError } from '../api/client';
import type { Gender } from '../types';

type Mode = 'pick' | 'auth';
type AuthMode = 'signup' | 'login';

// Backend error codes (CONTRACT.md §7) mapped to copy a user can act on, rather than
// showing the raw code (e.g. "gender_required", "invalid_code") as-is.
function authErrorMessage(err: unknown): string | null {
  if (!(err instanceof ApiError)) return null;
  switch (err.body?.error) {
    case 'invalid_code':
      return "That code didn't match. Please try again.";
    case 'rate_limited':
      return 'Too many attempts — please wait a few minutes and try again.';
    case 'invalid_input':
      return 'Please check the number and try again.';
    case 'gender_required':
      // Handled by a full reset in submitCode's onError — shouldn't normally be shown, but
      // fall back to something sensible if it ever surfaces here.
      return "We couldn't find an account with that number.";
    default:
      return err.message;
  }
}

export function WelcomeScreen() {
  const [mode, setMode] = useState<Mode>('pick');
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
  }, [fadeAnim]);
  const [authMode, setAuthMode] = useState<AuthMode>('signup');
  const [gender, setGender] = useState<Gender | null>(null);
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
    setMode('auth');
  };

  const startLogin = () => {
    setGender(null);
    setAuthMode('login');
    setNotice(null);
    resetAuthForm();
    setMode('auth');
  };

  const goBack = () => {
    if (otpSent) {
      setOtpSent(false);
      setCode('');
      verifyOtp.reset();
    } else {
      setMode('pick');
    }
  };

  const submitPhone = () => {
    const trimmed = phone.trim();
    if (!trimmed) return;
    sendOtp.mutate(trimmed, { onSuccess: () => setOtpSent(true) });
  };

  const submitCode = () => {
    const trimmed = code.trim();
    if (!trimmed) return;
    // Only signups (an "I am a..." pick was made) send `gender` — the backend requires it to
    // create a brand-new account and ignores it for an existing one (CONTRACT.md §7.2).
    verifyOtp.mutate(
      { phone: phone.trim(), code: trimmed, gender: authMode === 'signup' ? gender ?? undefined : undefined },
      {
        onError: (err) => {
          // "Log in" was used on a number with no account yet. The code the user just entered
          // is already consumed (OTP codes are single-use once accepted server-side), so there's
          // no code left to retry with — send them back to pick a role and start over with a
          // fresh code, rather than leaving them stuck on a screen where "Verify" can't work.
          if (err instanceof ApiError && err.body?.error === 'gender_required') {
            resetAuthForm();
            setMode('pick');
            setNotice("We couldn't find an account with that number — choose \"I am a...\" below to sign up.");
          }
        },
      }
    );
  };

  const headerTitle = otpSent ? 'Enter code' : authMode === 'signup' ? 'Verify your number' : 'Log in';

  return (
    <Screen>
      {mode === 'auth' ? <Header title={headerTitle} onBack={goBack} /> : null}
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {mode === 'pick' ? (
            <>
              <Animated.View style={[styles.brandBand, { opacity: fadeAnim }]}>
                <Text style={styles.brandEyebrow}>ISLAMIC MATRIMONY  ·  SHARIAH-GUIDED</Text>
                <Text style={styles.brand}>KIFAAH</Text>
                <View style={styles.rule} />
                <Text style={styles.intro}>
                  A matrimony app for the Muslim community — built around Shariah etiquette: photos stay blurred,
                  contact details stay hidden, and every profile is guardian-aware, until both sides agree to connect.
                </Text>
              </Animated.View>
              {notice ? <Text style={styles.error}>{notice}</Text> : null}
              <Text style={styles.eyebrow}>I am a</Text>
              <Button title="Brother, looking for a sister" variant="surface" onPress={() => pick('groom')} />
              <Button title="Sister, looking for a brother" variant="surface" onPress={() => pick('bride')} />
              <Button title="Already have an account? Log in" variant="text" onPress={startLogin} />
            </>
          ) : !otpSent ? (
            <View style={styles.authForm}>
              <View>
                <FieldLabel>Phone number</FieldLabel>
                <TextField
                  value={phone}
                  onChangeText={setPhone}
                  placeholder="+919812345678"
                  autoCapitalize="none"
                  keyboardType="phone-pad"
                  autoComplete="tel"
                  textContentType="telephoneNumber"
                />
                <Text style={styles.hint}>Include your country code. We'll text you a 6-digit code.</Text>
              </View>
              {errorMsg ? <Text style={styles.error}>{errorMsg}</Text> : null}
              <Button title="Send code" onPress={submitPhone} loading={pending} disabled={phone.trim().length < 8} />
            </View>
          ) : (
            <View style={styles.authForm}>
              <Text style={styles.hint}>Enter the code sent to {phone.trim()}.</Text>
              <View>
                <FieldLabel>6-digit code</FieldLabel>
                <TextField
                  value={code}
                  onChangeText={setCode}
                  placeholder="123456"
                  keyboardType="number-pad"
                  autoComplete="one-time-code"
                  textContentType="oneTimeCode"
                  maxLength={6}
                />
              </View>
              {errorMsg ? <Text style={styles.error}>{errorMsg}</Text> : null}
              <Button title="Verify" onPress={submitCode} loading={pending} disabled={code.trim().length !== 6} />
              <Button
                title="Resend code"
                variant="text"
                onPress={() => sendOtp.mutate(phone.trim())}
                disabled={pending}
              />
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: {
    padding: 24,
    paddingTop: 40,
    paddingBottom: 32,
    gap: 20,
  },
  brandBand: {
    marginHorizontal: -24,
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 24,
    gap: 10,
    backgroundColor: colors.greenBg,
  },
  brandEyebrow: {
    fontFamily: fonts.semiBold,
    fontSize: 11,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.greenText,
  },
  brand: {
    fontFamily: fonts.extraBold,
    fontSize: 32,
    letterSpacing: -0.5,
    color: colors.ink,
  },
  rule: {
    height: 2,
    width: 56,
    backgroundColor: colors.red,
  },
  intro: {
    fontFamily: fonts.regular,
    fontSize: 15,
    lineHeight: 23,
    color: '#444141',
  },
  eyebrow: {
    fontFamily: fonts.regular,
    fontSize: 11,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.muted,
    marginTop: 4,
  },
  authForm: {
    gap: 16,
  },
  hint: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.muted,
    marginTop: 6,
  },
  error: {
    fontFamily: fonts.semiBold,
    fontSize: 12,
    color: colors.redDark,
  },
});
