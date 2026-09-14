import type { NavigatorScreenParams } from '@react-navigation/native';

export type MainTabParamList = {
  Discover: undefined;
  Matches: undefined;
  Chat: undefined;
  Account: undefined;
};

export type RootStackParamList = {
  Welcome: undefined;
  ShariahQA: undefined;
  ProfileSetup: undefined;
  Main: NavigatorScreenParams<MainTabParamList>;
  ProfileDetail: { profileId: string; origin: 'discover' | 'matches' | 'notification' };
  Pricing: { returnTo: 'account' | 'detail'; pendingInterestProfileId?: string } | undefined;
  Payment: {
    tier: 'basic' | 'premium';
    billing: 'monthly' | 'annual';
    returnTo: 'account' | 'detail';
    pendingInterestProfileId?: string;
  };
  ChatThread: { userId: string; name: string };
  FAQ: undefined;
};
