import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { colors } from '../theme/tokens';
import { useAuthStore } from '../store/authStore';
import { useMe } from '../api/hooks/useAuth';
import type { RootStackParamList } from './types';

import { WelcomeScreen } from '../screens/WelcomeScreen';
import { ShariahQAScreen } from '../screens/ShariahQAScreen';
import { ProfileSetupScreen } from '../screens/ProfileSetupScreen';
import { MainTabNavigator } from './MainTabNavigator';
import { ProfileDetailScreen } from '../screens/ProfileDetailScreen';
import { PricingScreen } from '../screens/PricingScreen';
import { PaymentScreen } from '../screens/PaymentScreen';
import { ChatThreadScreen } from '../screens/ChatThreadScreen';
import { FAQScreen } from '../screens/FAQScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

// Two separate stack trees, swapped at the top level rather than reset imperatively: when
// `onboarded` flips (signup, profile finished, or login) React unmounts one tree and mounts
// the other fresh, so each always starts at the right screen with no leftover history.

function AuthStack({ initialRoute }: { initialRoute: 'Welcome' | 'ShariahQA' | 'ProfileSetup' }) {
  return (
    <Stack.Navigator initialRouteName={initialRoute} screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Welcome" component={WelcomeScreen} />
      <Stack.Screen name="ShariahQA" component={ShariahQAScreen} />
      <Stack.Screen name="ProfileSetup" component={ProfileSetupScreen} />
    </Stack.Navigator>
  );
}

function MainStack() {
  return (
    <Stack.Navigator initialRouteName="Main" screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Main" component={MainTabNavigator} />
      <Stack.Screen name="ProfileDetail" component={ProfileDetailScreen} />
      <Stack.Screen name="Pricing" component={PricingScreen} />
      <Stack.Screen name="Payment" component={PaymentScreen} />
      <Stack.Screen name="ChatThread" component={ChatThreadScreen} />
      <Stack.Screen name="FAQ" component={FAQScreen} />
    </Stack.Navigator>
  );
}

export function RootNavigator() {
  const token = useAuthStore((s) => s.token);
  const hydrated = useAuthStore((s) => s.hydrated);
  const { data: me, isLoading } = useMe(!!token);

  if (!hydrated || (token && isLoading)) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}>
        <ActivityIndicator color={colors.red} />
      </View>
    );
  }

  const onboarded = !!token && !!me?.profile?.wali;
  if (onboarded) return <MainStack />;

  return <AuthStack initialRoute={token ? 'ShariahQA' : 'Welcome'} />;
}
