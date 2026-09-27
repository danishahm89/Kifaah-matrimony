import type { NavigatorScreenParams } from '@react-navigation/native';

export type MainTabParamList = {
  Discover: undefined;
  Matches: undefined;
  Chat: undefined;
  Account: undefined;
};

export type RootStackParamList = {
  Welcome: undefined;
  // `edit: true` = the member is changing an existing profile from the Profile tab.
  ShariahQA: { edit?: boolean } | undefined;
  ProfileSetup: { edit?: boolean } | undefined;
  Main: NavigatorScreenParams<MainTabParamList>;
  ProfileDetail: { profileId: string; origin: 'discover' | 'matches' | 'notification' };
  Pricing: { returnTo: 'account' | 'detail'; pendingInterestProfileId?: string } | undefined;
  Payment: {
    tier: 'basic' | 'premium';
    billing: 'monthly' | 'annual';
    returnTo: 'account' | 'detail';
    pendingInterestProfileId?: string;
  };
  // `name` is optional so a notification (which only carries the other user's id — CONTRACT §8.6)
  // can navigate straight here; ChatThreadScreen falls back to the cached conversations list (and
  // finally a generic label) when it's missing.
  ChatThread: { userId: string; name?: string };
  FAQ: undefined;
  Support: undefined;
  Legal: { doc?: 'terms' | 'privacy' | 'refund' | 'grievance' } | undefined;
  Health: undefined;
  Admin: undefined;
};
