import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { createBottomTabNavigator, BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts } from '../theme/tokens';
import { TabDiscoverIcon, TabMatchesIcon, TabChatIcon, TabAccountIcon } from '../icons';
import { useAuthStore } from '../store/authStore';
import { tabStrings } from '../i18n/strings';
import type { MainTabParamList } from './types';

import { DiscoverScreen } from '../screens/DiscoverScreen';
import { MatchesScreen } from '../screens/MatchesScreen';
import { ChatListScreen } from '../screens/ChatListScreen';
import { AccountScreen } from '../screens/AccountScreen';

const Tab = createBottomTabNavigator<MainTabParamList>();

const ICONS: Record<keyof MainTabParamList, React.ComponentType<{ size?: number; color?: string }>> = {
  Discover: TabDiscoverIcon,
  Matches: TabMatchesIcon,
  Chat: TabChatIcon,
  Account: TabAccountIcon,
};

function CustomTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const lang = useAuthStore((s) => s.user?.language ?? 'en');
  const T = tabStrings(lang);
  const labels: Record<keyof MainTabParamList, string> = {
    Discover: T.discover,
    Matches: T.matches,
    Chat: T.chat,
    Account: T.account,
  };

  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
      {state.routes.map((route, index) => {
        const focused = state.index === index;
        const Icon = ICONS[route.name as keyof MainTabParamList];
        const color = focused ? colors.redDark : colors.mutedLight;
        return (
          <Pressable
            key={route.key}
            onPress={() => {
              const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
              if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
            }}
            style={styles.tabBtn}
          >
            <Icon size={18} color={color} />
            <Text style={[styles.label, { color }]}>{labels[route.name as keyof MainTabParamList]}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function MainTabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <CustomTabBar {...props} />}
    >
      <Tab.Screen name="Discover" component={DiscoverScreen} />
      <Tab.Screen name="Matches" component={MatchesScreen} />
      <Tab.Screen name="Chat" component={ChatListScreen} />
      <Tab.Screen name="Account" component={AccountScreen} />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    borderTopWidth: 2,
    borderTopColor: colors.border,
    backgroundColor: colors.bg,
    paddingTop: 10,
  },
  tabBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingBottom: 6,
  },
  label: {
    fontFamily: fonts.extraBold,
    fontSize: 10,
  },
});
