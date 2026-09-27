import React from 'react';
import { tr } from '../i18n/t';
import {
  View, Text, Pressable, useWindowDimensions, StyleSheet, Platform,
} from 'react-native';
import { createBottomTabNavigator, BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeContext';
import { useAuthStore } from '../store/authStore';
import { tabStrings } from '../i18n/strings';
import {
  TabDiscoverIcon, TabMatchesIcon, TabChatIcon, TabAccountIcon,
} from '../icons';
import { DiscoverScreen } from '../screens/DiscoverScreen';
import { MatchesScreen } from '../screens/MatchesScreen';
import { ChatListScreen } from '../screens/ChatListScreen';
import { AccountScreen } from '../screens/AccountScreen';
import { Badge } from '../components/Badge';
import { useBadgeCounts } from '../hooks/useBadgeCounts';

export type MainTabParamList = {
  Discover: undefined;
  Matches: undefined;
  Chat: undefined;
  Account: undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();

export const DESKTOP_BREAKPOINT = 768;
export const SIDEBAR_WIDTH = 230;

const ICONS: Record<keyof MainTabParamList, React.ComponentType<{ size?: number; color?: string }>> = {
  Discover: TabDiscoverIcon,
  Matches: TabMatchesIcon,
  Chat: TabChatIcon,
  Account: TabAccountIcon,
};

// ─── Desktop Sidebar ───────────────────────────────────────────────────────
function DesktopSidebar({ state, navigation }: BottomTabBarProps) {
  const { colors, mode, toggle } = useTheme();
  const badges = useBadgeCounts();
  const lang = useAuthStore((s) => s.user?.language ?? 'en');
  const T = tabStrings(lang);
  const labels: Record<keyof MainTabParamList, string> = {
    Discover: T.discover,
    Matches: T.matches,
    Chat: T.chat,
    Account: T.account,
  };

  return (
    <View style={[sidebarStyles.sidebar, {
      backgroundColor: colors.bgCard,
      borderRightColor: colors.border,
    }]}>
      {/* Logo */}
      <View style={[sidebarStyles.logoArea, { borderBottomColor: colors.borderHairline }]}>
        <Text style={[sidebarStyles.logoText, { color: colors.primary }]}>{tr("☪ Kifaah")}</Text>
        <Text style={[sidebarStyles.logoSub, { color: colors.muted }]}>{tr("Shariah-guided matrimony")}</Text>
      </View>

      {/* Nav items */}
      <View style={sidebarStyles.navArea}>
        {state.routes.map((route, index) => {
          const focused = state.index === index;
          const Icon = ICONS[route.name as keyof MainTabParamList];
          const label = labels[route.name as keyof MainTabParamList];
          return (
            <Pressable
              key={route.key}
              onPress={() => {
                const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
                if (!focused && !event.defaultPrevented) navigation.navigate(route.name as any);
              }}
              style={({ pressed, hovered }: any) => [sidebarStyles.navItem, {
                backgroundColor: focused ? colors.greenBg : pressed || hovered ? colors.borderHairline : 'transparent',
                borderLeftColor: focused ? colors.primary : 'transparent',
              }]}
            >
              <Icon size={20} color={focused ? colors.primary : colors.muted} />
              <Text style={[sidebarStyles.navLabel, {
                color: focused ? colors.primary : colors.muted,
                fontWeight: focused ? '700' : '400',
                flex: 1,
              }]}>{label}</Text>
              <Badge count={badges[route.name] ?? 0} />
            </Pressable>
          );
        })}
      </View>

      {/* Footer */}
      <View style={sidebarStyles.sidebarFooter}>
        <Pressable
          onPress={() => navigation.getParent()?.navigate('Support' as never)}
          style={({ pressed }) => [sidebarStyles.supportLink, { backgroundColor: pressed ? colors.borderHairline : 'transparent' }]}
        >
          <Text style={{ fontSize: 14, color: colors.muted }}>{tr("❓ Help & Support")}</Text>
        </Pressable>
        <Pressable onPress={toggle} style={[sidebarStyles.themeToggle, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={{ fontSize: 14, color: colors.ink }}>{mode === 'dark' ? '☀ ' + tr('Light mode') : '🌙 ' + tr('Dark mode')}</Text>
        </Pressable>
      </View>
    </View>
  );
}

// ─── Mobile Bottom Bar ─────────────────────────────────────────────────────
function MobileTabBar({ state, navigation }: BottomTabBarProps) {
  const { colors } = useTheme();
  const badges = useBadgeCounts();
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
    <View style={[mobileBarStyles.bar, {
      paddingBottom: Math.max(insets.bottom, 12),
      backgroundColor: colors.bg,
      borderTopColor: colors.border,
    }]}>
      {state.routes.map((route, index) => {
        const focused = state.index === index;
        const Icon = ICONS[route.name as keyof MainTabParamList];
        const color = focused ? colors.primary : colors.muted;
        return (
          <Pressable
            key={route.key}
            onPress={() => {
              const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
              if (!focused && !event.defaultPrevented) navigation.navigate(route.name as any);
            }}
            style={mobileBarStyles.tabBtn}
          >
            <View>
              <Icon size={18} color={color} />
              <Badge count={badges[route.name] ?? 0} style={mobileBarStyles.badge} />
            </View>
            <Text style={[mobileBarStyles.label, { color }]}>{labels[route.name as keyof MainTabParamList]}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// ─── Combined tab bar: sidebar on desktop, bottom bar on mobile ─────────────
function CustomTabBar(props: BottomTabBarProps) {
  const { width } = useWindowDimensions();
  if (Platform.OS === 'web' && width >= DESKTOP_BREAKPOINT) {
    return <DesktopSidebar {...props} />;
  }
  return <MobileTabBar {...props} />;
}

// ─── Main Navigator ─────────────────────────────────────────────────────────
export function MainTabNavigator() {
  const { width } = useWindowDimensions();
  const isDesktop = Platform.OS === 'web' && width >= DESKTOP_BREAKPOINT;

  return (
    <Tab.Navigator
      // React Navigation 7 removed `sceneContainerStyle`, so the old marginLeft was silently
      // ignored and the fixed sidebar covered the content. `tabBarPosition: 'left'` lays the
      // sidebar and the screen out side by side instead.
      screenOptions={{ headerShown: false, tabBarPosition: isDesktop ? 'left' : 'bottom' }}
      tabBar={(props) => <CustomTabBar {...props} />}
    >
      <Tab.Screen name="Discover" component={DiscoverScreen} />
      <Tab.Screen name="Matches" component={MatchesScreen} />
      <Tab.Screen name="Chat" component={ChatListScreen} />
      <Tab.Screen name="Account" component={AccountScreen} />
    </Tab.Navigator>
  );
}

// ─── Sidebar styles ──────────────────────────────────────────────────────────
const sidebarStyles = StyleSheet.create({
  sidebar: {
    width: SIDEBAR_WIDTH,
    height: '100%' as any,
    borderRightWidth: 1,
    flexShrink: 0,
    zIndex: 100,
    ...({ overflowY: 'auto' } as any),
  },
  logoArea: {
    paddingHorizontal: 20,
    paddingTop: 28,
    paddingBottom: 20,
    borderBottomWidth: 1,
  },
  logoText: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  logoSub: {
    fontSize: 11,
    marginTop: 2,
    fontWeight: '400',
  },
  navArea: {
    flex: 1,
    paddingTop: 12,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 13,
    gap: 12,
    borderLeftWidth: 3,
    marginVertical: 1,
  },
  navLabel: {
    fontSize: 15,
  },
  sidebarFooter: {
    padding: 16,
    paddingBottom: 28,
    gap: 8,
  },
  supportLink: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
  },
  themeToggle: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    alignItems: 'center',
  },
});

// ─── Mobile tab bar styles ───────────────────────────────────────────────────
const mobileBarStyles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    borderTopWidth: 2,
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
    fontSize: 10,
    fontWeight: '700',
  },
  badge: {
    position: 'absolute',
    top: -8,
    right: -14,
  },
});
