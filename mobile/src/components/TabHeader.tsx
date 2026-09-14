import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '../theme/tokens';
import { BellIcon, GlobeIcon } from '../icons';
import { useNotifications, useMarkNotificationsRead } from '../api/hooks/useNotifications';
import { useToggleLanguage } from '../api/hooks/useAccount';
import { useAuthStore } from '../store/authStore';
import { langToggleLabel } from '../i18n/strings';

interface Props {
  title: string;
  onOpenNotification: (candidateId: string) => void;
}

export function TabHeader({ title, onOpenNotification }: Props) {
  const [notifOpen, setNotifOpen] = useState(false);
  const { data: notifications = [] } = useNotifications();
  const markRead = useMarkNotificationsRead();
  const toggleLang = useToggleLanguage();
  const lang = useAuthStore((s) => s.user?.language ?? 'en');

  const hasUnread = notifications.some((n) => !n.read);

  const openNotif = () => {
    const opening = !notifOpen;
    setNotifOpen(opening);
    if (opening && hasUnread) markRead.mutate();
  };

  return (
    <View>
      <View style={styles.row}>
        <Text style={styles.title}>{title}</Text>
        <View style={styles.actions}>
          <Pressable style={styles.iconBtn} onPress={openNotif}>
            <BellIcon />
            {hasUnread ? <View style={styles.dot} /> : null}
          </Pressable>
          <Pressable
            style={styles.langBtn}
            onPress={() => toggleLang.mutate(lang === 'ur' ? 'en' : 'ur')}
          >
            <GlobeIcon size={13} />
            <Text style={styles.langText}>{langToggleLabel(lang)}</Text>
          </Pressable>
        </View>
      </View>

      {notifOpen ? (
        <View style={styles.panel}>
          <View style={styles.panelHeader}>
            <Text style={styles.panelTitle}>Match recommendations</Text>
            <Text style={styles.panelSub}>Weekly + on signup</Text>
          </View>
          {notifications.length > 0 ? (
            <ScrollView style={styles.panelList}>
              {notifications.map((n) => (
                <Pressable
                  key={n.id}
                  style={styles.notifRow}
                  onPress={() => {
                    setNotifOpen(false);
                    onOpenNotification(n.candidateId);
                  }}
                >
                  <View style={[styles.notifDot, n.read && styles.notifDotRead]} />
                  <View style={styles.notifBody}>
                    <Text style={styles.notifText}>{n.text}</Text>
                    <Text style={styles.notifWhen}>{n.label}</Text>
                  </View>
                </Pressable>
              ))}
            </ScrollView>
          ) : (
            <Text style={styles.empty}>No recommendations yet.</Text>
          )}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
    borderBottomWidth: 2,
    borderBottomColor: colors.border,
  },
  title: {
    fontFamily: fonts.extraBold,
    fontSize: 22,
    color: colors.ink,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  iconBtn: {
    width: 32,
    height: 32,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    position: 'absolute',
    top: -3,
    right: -3,
    width: 8,
    height: 8,
    borderRadius: 50,
    backgroundColor: colors.red,
  },
  langBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    paddingVertical: 6,
    paddingHorizontal: 9,
  },
  langText: {
    fontFamily: fonts.semiBold,
    fontSize: 11,
    color: colors.ink,
  },
  panel: {
    position: 'absolute',
    top: 54,
    left: 16,
    right: 16,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    maxHeight: 320,
    zIndex: 30,
    elevation: 6,
  },
  panelHeader: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  panelTitle: {
    fontFamily: fonts.extraBold,
    fontSize: 13,
    color: colors.ink,
  },
  panelSub: {
    fontSize: 10,
    fontFamily: fonts.semiBold,
    color: colors.muted,
  },
  panelList: {
    maxHeight: 280,
  },
  notifRow: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderHairline,
    flexDirection: 'row',
    gap: 10,
  },
  notifDot: {
    width: 6,
    height: 6,
    borderRadius: 50,
    backgroundColor: colors.red,
    marginTop: 6,
  },
  notifDotRead: {
    backgroundColor: '#bab6b6',
  },
  notifBody: {
    flex: 1,
  },
  notifText: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.ink,
    lineHeight: 18,
  },
  notifWhen: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: colors.muted,
    marginTop: 2,
  },
  empty: {
    padding: 20,
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.muted,
  },
});
