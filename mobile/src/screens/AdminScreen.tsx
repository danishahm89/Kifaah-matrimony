import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts } from '../theme/tokens';
type AdminTab = 'users' | 'tickets' | 'reports';

const MOCK_USERS = [
  { id: '1', name: 'Fatima Khan', email: 'fatima@example.com', status: 'active', joined: '2024-01-15' },
  { id: '2', name: 'Ahmed Ali', email: 'ahmed@example.com', status: 'suspended', joined: '2024-02-10' },
  { id: '3', name: 'Sara Malik', email: 'sara@example.com', status: 'active', joined: '2024-03-05' },
  { id: '4', name: 'Usman Raza', email: 'usman@example.com', status: 'pending', joined: '2024-04-01' },
];

const MOCK_TICKETS = [
  { id: 'T001', user: 'Fatima Khan', issue: 'Cannot upload photos', status: 'open', priority: 'high', date: '2024-04-10' },
  { id: 'T002', user: 'Ahmed Ali', issue: 'Match not loading', status: 'resolved', priority: 'medium', date: '2024-04-08' },
  { id: 'T003', user: 'Sara Malik', issue: 'Payment failed', status: 'open', priority: 'high', date: '2024-04-12' },
  { id: 'T004', user: 'Usman Raza', issue: 'Profile not showing', status: 'in_progress', priority: 'low', date: '2024-04-11' },
];

const STATUS_COLOR: Record<string, string> = {
  active: '#4CAF50', suspended: '#F44336', pending: '#FF9800',
  open: '#F44336', resolved: '#4CAF50', in_progress: '#2196F3',
};

const PRIORITY_COLOR: Record<string, string> = {
  high: '#F44336', medium: '#FF9800', low: '#4CAF50',
};

export function AdminScreen() {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<AdminTab>('users');
  const [search, setSearch] = useState('');

  const filteredUsers = MOCK_USERS.filter(u =>
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  const filteredTickets = MOCK_TICKETS.filter(t =>
    t.user.toLowerCase().includes(search.toLowerCase()) ||
    t.issue.toLowerCase().includes(search.toLowerCase())
  );

  const handleUserAction = (user: typeof MOCK_USERS[0]) => {
    Alert.alert(
      `Actions for ${user.name}`,
      'What would you like to do?',
      [
        { text: user.status === 'suspended' ? 'Activate' : 'Suspend', onPress: () => {} },
        { text: 'View Profile', onPress: () => {} },
        { text: 'Send Message', onPress: () => {} },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const handleTicketAction = (ticket: typeof MOCK_TICKETS[0]) => {
    Alert.alert(
      `Ticket ${ticket.id}`,
      ticket.issue,
      [
        { text: 'Mark Resolved', onPress: () => {} },
        { text: 'Assign to Me', onPress: () => {} },
        { text: 'Reply to User', onPress: () => {} },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Admin & Support</Text>
      </View>

      {/* Tab Bar */}
      <View style={styles.tabBar}>
        {(['users', 'tickets', 'reports'] as AdminTab[]).map(t => (
          <TouchableOpacity
            key={t}
            style={[styles.tabItem, tab === t && styles.tabItemActive]}
            onPress={() => setTab(t)}
          >
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
              {t === 'users' ? '👥 Users' : t === 'tickets' ? '🎫 Tickets' : '📊 Reports'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Search */}
      <View style={styles.searchBar}>
        <TextInput
          style={styles.searchInput}
          placeholder={`Search ${tab}...`}
          value={search}
          onChangeText={setSearch}
          placeholderTextColor="#aaa"
        />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {tab === 'users' && (
          <>
            {/* Stats Row */}
            <View style={styles.statsRow}>
              {[
                { label: 'Total', value: MOCK_USERS.length, color: '#2196F3' },
                { label: 'Active', value: MOCK_USERS.filter(u => u.status === 'active').length, color: '#4CAF50' },
                { label: 'Suspended', value: MOCK_USERS.filter(u => u.status === 'suspended').length, color: '#F44336' },
                { label: 'Pending', value: MOCK_USERS.filter(u => u.status === 'pending').length, color: '#FF9800' },
              ].map(s => (
                <View key={s.label} style={[styles.statCard, { borderTopColor: s.color }]}>
                  <Text style={[styles.statValue, { color: s.color }]}>{s.value}</Text>
                  <Text style={styles.statLabel}>{s.label}</Text>
                </View>
              ))}
            </View>

            {filteredUsers.map(u => (
              <TouchableOpacity key={u.id} style={styles.card} onPress={() => handleUserAction(u)}>
                <View style={styles.rowBetween}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{u.name[0]}</Text>
                  </View>
                  <View style={styles.flex1}>
                    <Text style={styles.cardName}>{u.name}</Text>
                    <Text style={styles.cardMeta}>{u.email}</Text>
                    <Text style={styles.cardMeta}>Joined: {u.joined}</Text>
                  </View>
                  <View style={[styles.badge, { backgroundColor: STATUS_COLOR[u.status] + '20' }]}>
                    <Text style={[styles.badgeText, { color: STATUS_COLOR[u.status] }]}>
                      {u.status}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </>
        )}

        {tab === 'tickets' && (
          <>
            <View style={styles.statsRow}>
              {[
                { label: 'Open', value: MOCK_TICKETS.filter(t => t.status === 'open').length, color: '#F44336' },
                { label: 'In Progress', value: MOCK_TICKETS.filter(t => t.status === 'in_progress').length, color: '#2196F3' },
                { label: 'Resolved', value: MOCK_TICKETS.filter(t => t.status === 'resolved').length, color: '#4CAF50' },
              ].map(s => (
                <View key={s.label} style={[styles.statCard, { borderTopColor: s.color }]}>
                  <Text style={[styles.statValue, { color: s.color }]}>{s.value}</Text>
                  <Text style={styles.statLabel}>{s.label}</Text>
                </View>
              ))}
            </View>

            {filteredTickets.map(t => (
              <TouchableOpacity key={t.id} style={styles.card} onPress={() => handleTicketAction(t)}>
                <View style={styles.rowBetween}>
                  <View style={styles.flex1}>
                    <View style={styles.rowBetween}>
                      <Text style={styles.ticketId}>{t.id}</Text>
                      <View style={[styles.badge, { backgroundColor: PRIORITY_COLOR[t.priority] + '20' }]}>
                        <Text style={[styles.badgeText, { color: PRIORITY_COLOR[t.priority] }]}>
                          {t.priority}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.cardName}>{t.issue}</Text>
                    <Text style={styles.cardMeta}>👤 {t.user} · {t.date}</Text>
                  </View>
                  <View style={[styles.badge, { backgroundColor: STATUS_COLOR[t.status] + '20', marginLeft: 8 }]}>
                    <Text style={[styles.badgeText, { color: STATUS_COLOR[t.status] }]}>
                      {t.status.replace('_', ' ')}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </>
        )}

        {tab === 'reports' && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>📊 Quick Reports</Text>
            {[
              { label: 'New users this week', value: '12' },
              { label: 'Matches made today', value: '34' },
              { label: 'Messages sent today', value: '156' },
              { label: 'Active subscriptions', value: '89' },
              { label: 'Tickets resolved this week', value: '7' },
              { label: 'Revenue this month', value: '₹45,200' },
            ].map(r => (
              <View key={r.label} style={styles.reportRow}>
                <Text style={styles.reportLabel}>{r.label}</Text>
                <Text style={styles.reportValue}>{r.value}</Text>
              </View>
            ))}
            <Text style={styles.reportNote}>* Data is mock/placeholder for testing. Connect to real API for live data.</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  header: {
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: colors.primary ?? '#6B3F8C',
  },
  title: { fontSize: 18, fontFamily: fonts.semiBold ?? fonts.regular, color: '#fff' },
  tabBar: { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#eee' },
  tabItem: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  tabItemActive: { borderBottomWidth: 2, borderBottomColor: colors.primary ?? '#6B3F8C' },
  tabText: { fontSize: 13, color: '#888' },
  tabTextActive: { color: colors.primary ?? '#6B3F8C', fontFamily: fonts.semiBold ?? fonts.regular },
  searchBar: { backgroundColor: '#fff', paddingHorizontal: 16, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#eee' },
  searchInput: {
    backgroundColor: '#f5f5f5', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8,
    fontSize: 14, color: '#333',
  },
  content: { padding: 12, gap: 8 },
  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 4 },
  statCard: {
    flex: 1, backgroundColor: '#fff', borderRadius: 8, padding: 10,
    alignItems: 'center', borderTopWidth: 3,
  },
  statValue: { fontSize: 20, fontFamily: fonts.semiBold ?? fonts.regular },
  statLabel: { fontSize: 11, color: '#888', marginTop: 2 },
  card: {
    backgroundColor: '#fff', borderRadius: 10, padding: 14,
    marginBottom: 8, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  cardTitle: { fontSize: 15, fontFamily: fonts.semiBold ?? fonts.regular, color: '#222', marginBottom: 12 },
  cardName: { fontSize: 14, fontFamily: fonts.semiBold ?? fonts.regular, color: '#222', marginBottom: 2 },
  cardMeta: { fontSize: 12, color: '#888' },
  rowBetween: { flexDirection: 'row', alignItems: 'center' },
  flex1: { flex: 1 },
  avatar: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primary ?? '#6B3F8C',
    alignItems: 'center', justifyContent: 'center', marginRight: 12,
  },
  avatarText: { color: '#fff', fontSize: 16, fontFamily: fonts.semiBold ?? fonts.regular },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12 },
  badgeText: { fontSize: 11, fontFamily: fonts.semiBold ?? fonts.regular, textTransform: 'capitalize' },
  ticketId: { fontSize: 12, color: '#888', flex: 1 },
  reportRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f0f0f0',
  },
  reportLabel: { fontSize: 13, color: '#555' },
  reportValue: { fontSize: 14, fontFamily: fonts.semiBold ?? fonts.regular, color: '#222' },
  reportNote: { fontSize: 11, color: '#aaa', marginTop: 12, fontStyle: 'italic' },
});
